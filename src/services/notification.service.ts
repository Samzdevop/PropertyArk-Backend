import prisma from "../prisma";
import { Role, NotificationType, NotificationChannel, NotificationPriority } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import { MailInterface } from "../interfaces/mail.interfaces";
import { v4 as uuidv4 } from "uuid";

export interface NotificationData {
  title: string;
  message: string;
  type?: NotificationType;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  data?: any;
}

export interface BulkNotificationData extends NotificationData {
  target: 'ALL' | 'VENDOR' | 'USER' | 'STAFF' | 'SPECIFIC';
  userIds?: string[];
  roles?: Role[];
}

export class NotificationService {


  static async sendToUser(
    userId: string,
    data: NotificationData,
    senderId?: string
  ): Promise<any> {
    const {
      title,
      message,
      type = NotificationType.GENERAL,
      channel = NotificationChannel.IN_APP,
      priority = NotificationPriority.NORMAL,
      data: additionalData
    } = data;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, isVerified: true }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: additionalData || {},
        channel,
        priority,
        sentAt: new Date(),
        isBulk: false
      }
    });


    if (channel === NotificationChannel.EMAIL || channel === NotificationChannel.BOTH) {
      await this.sendEmailNotification(user, { title, message, type, priority });
    }

    Logger.info(`Notification sent to user ${userId}: ${title}`);

    if (senderId) {
      await prisma.activityLog.create({
        data: {
          userId: senderId,
          action: 'SEND_NOTIFICATION',
          entityType: 'NOTIFICATION',
          entityId: notification.id,
          description: `Sent notification "${title}" to user ${user.fullName}`,
          details: {
            recipientId: userId,
            recipientEmail: user.email,
            channel,
            priority
          }
        }
      });
    }

    return notification;
  }


  static async sendBulkNotification(
    data: BulkNotificationData,
    senderId: string
  ): Promise<any> {
    const {
      title,
      message,
      type = NotificationType.GENERAL,
      channel = NotificationChannel.IN_APP,
      priority = NotificationPriority.NORMAL,
      target,
      userIds = [],
      roles = [],
      data: additionalData
    } = data;

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { role: true }
    });

    if (!sender || sender.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can send bulk notifications");
    }

    let targetUsers: any[] = [];

    switch (target) {
      case 'ALL':
        targetUsers = await prisma.user.findMany({
          where: { isVerified: true, isSuspended: false },
          select: { id: true, email: true, fullName: true }
        });
        break;

      case 'VENDOR':
        targetUsers = await prisma.user.findMany({
          where: { role: Role.VENDOR, isVerified: true, isSuspended: false },
          select: { id: true, email: true, fullName: true }
        });
        break;

      case 'USER':
        targetUsers = await prisma.user.findMany({
          where: { role: Role.USER, isVerified: true, isSuspended: false },
          select: { id: true, email: true, fullName: true }
        });
        break;

      case 'STAFF':
        targetUsers = await prisma.user.findMany({
          where: { role: Role.STAFF, isVerified: true, isSuspended: false },
          select: { id: true, email: true, fullName: true }
        });
        break;

      case 'SPECIFIC':
        if (!userIds || userIds.length === 0) {
          throw new BadRequestError("User IDs are required for specific target");
        }
        targetUsers = await prisma.user.findMany({
          where: {
            id: { in: userIds },
            isVerified: true,
            isSuspended: false
          },
          select: { id: true, email: true, fullName: true }
        });
        break;

      default:
        throw new BadRequestError("Invalid target type");
    }

    if (targetUsers.length === 0) {
      throw new BadRequestError("No users found for the specified target");
    }

    // Generate bulk ID for tracking
    const bulkId = uuidv4();

    // Create bulk notification record
    const bulkNotification = await prisma.bulkNotification.create({
      data: {
        bulkId,
        title,
        message,
        channel,
        priority,
        targetAudience: target,
        targetUserIds: targetUsers.map(u => u.id),
        targetRoles: roles.map(r => r.toString()),
        sentBy: senderId,
        sentAt: new Date()
      }
    });

    // Create notifications for each user
    const notifications = [];
    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const user of targetUsers) {
      try {
        // Create in-app notification
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            type,
            title,
            message,
            data: additionalData || {},
            channel,
            priority,
            sentAt: new Date(),
            isBulk: true,
            bulkId
          }
        });

        notifications.push(notification);
        sentCount++;

        // Send email if channel is EMAIL or BOTH
        if (channel === NotificationChannel.EMAIL || channel === NotificationChannel.BOTH) {
          try {
            await this.sendEmailNotification(user, { title, message, type, priority });
            deliveredCount++;
          } catch (emailError) {
            Logger.error(`Failed to send email to ${user.email}:`, emailError);
            failedCount++;
          }
        } else {
          deliveredCount++;
        }

      } catch (error) {
        Logger.error(`Failed to send notification to ${user.id}:`, error);
        failedCount++;
      }
    }

    // Update bulk notification stats
    await prisma.bulkNotification.update({
      where: { id: bulkNotification.id },
      data: {
        sentCount,
        deliveredCount,
        failedCount
      }
    });

    Logger.info(`Bulk notification sent to ${sentCount} users, ${deliveredCount} delivered, ${failedCount} failed`);

    return {
      bulkId,
      sentCount,
      deliveredCount,
      failedCount,
      notifications,
      bulkNotification
    };
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    user: any,
    data: { title: string; message: string; type: NotificationType; priority: NotificationPriority }
  ): Promise<void> {
    try {
      const { title, message, type, priority } = data;

      const emailHtml = await render('notification-email', {
        userName: user.fullName || user.email,
        title,
        message,
        type,
        priority,
        priorityColor: this.getPriorityColor(priority),
        currentYear: new Date().getFullYear(),
        dashboardUrl: `${process.env.FRONTEND_URL}/notifications`
      });

      const mailOptions: MailInterface = {
        to: user.email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: `Notification: ${title}`,
        text: message,
        html: emailHtml
      };

      await sendGraphMail(mailOptions);
      Logger.info(`Email notification sent to ${user.email}`);
    } catch (error) {
      Logger.error(`Failed to send email notification to ${user.email}:`, error);
      throw error;
    }
  }

  private static getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.LOW:
        return '#4CAF50';
      case NotificationPriority.NORMAL:
        return '#2196F3'; 
      case NotificationPriority.HIGH:
        return '#FF9800';
      case NotificationPriority.URGENT:
        return '#f44336';
      default:
        return '#2196F3';
    }
  }


  static async getUserNotifications(
    userId: string,
    filters: {
      read?: boolean;
      type?: NotificationType;
      channel?: NotificationChannel;
      priority?: NotificationPriority;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const { read, type, channel, priority, page = 1, limit = 20 } = filters;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { userId };

    if (read !== undefined) where.read = read;
    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (priority) where.priority = priority;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          channel: true,
          priority: true,
          data: true,
          read: true,
          readAt: true,
          createdAt: true,
          sentAt: true,
          isBulk: true,
          bulkId: true
        }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, read: false }
      })
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };
  }

  static async markAsRead(notificationId: string, userId: string): Promise<any> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError("You can only mark your own notifications as read");
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return updated;
  }


  static async markAllAsRead(userId: string): Promise<any> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return { count: result.count };
  }


  static async getNotificationStats(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalNotifications,
      totalRead,
      totalUnread,
      todayNotifications,
      thisWeekNotifications,
      thisMonthNotifications,
      byChannel,
      byPriority,
      byType,
      recentBulk
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { read: true } }),
      prisma.notification.count({ where: { read: false } }),
      prisma.notification.count({ where: { createdAt: { gte: today } } }),
      prisma.notification.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.notification.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.notification.groupBy({
        by: ['channel'],
        _count: true
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        _count: true
      }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: true,
        orderBy: { _count: { type: 'desc' } },
        take: 10
      }),
      prisma.bulkNotification.findMany({
        orderBy: { sentAt: 'desc' },
        take: 10,
        // include: {
        //   _count: {
        //     select: {
        //       notifications: true
        //     }
        //   }
        // }
      })
    ]);

    return {
      total: {
        notifications: totalNotifications,
        read: totalRead,
        unread: totalUnread
      },
      timeline: {
        today: todayNotifications,
        thisWeek: thisWeekNotifications,
        thisMonth: thisMonthNotifications
      },
      breakdown: {
        byChannel,
        byPriority,
        byType
      },
      recentBulk: recentBulk.map((b:any) => ({
        id: b.id,
        bulkId: b.bulkId,
        title: b.title,
        targetAudience: b.targetAudience,
        sentCount: b.sentCount,
        deliveredCount: b.deliveredCount,
        failedCount: b.failedCount,
        sentAt: b.sentAt
      }))
    };
  }


  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError("You can only delete your own notifications");
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });
  }

  /**
   * Get bulk notification details
   */
  static async getBulkNotificationDetails(bulkId: string): Promise<any> {
    const bulk = await prisma.bulkNotification.findUnique({
      where: { bulkId }
    });

    if (!bulk) {
      throw new NotFoundError("Bulk notification not found");
    }

    const notifications = await prisma.notification.findMany({
      where: { bulkId },
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        channel: true,
        priority: true,
        read: true,
        sentAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true
          }
        }
      }
    });

    return {
      ...bulk,
      notifications
    };
  }
}