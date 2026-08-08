"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
const uuid_1 = require("uuid");
class NotificationService {
    static async sendToUser(userId, data, senderId) {
        const { title, message, type = client_1.NotificationType.GENERAL, channel = client_1.NotificationChannel.IN_APP, priority = client_1.NotificationPriority.NORMAL, data: additionalData } = data;
        // Verify user exists
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, fullName: true, isVerified: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        // Create in-app notification
        const notification = await prisma_1.default.notification.create({
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
        if (channel === client_1.NotificationChannel.EMAIL || channel === client_1.NotificationChannel.BOTH) {
            await this.sendEmailNotification(user, { title, message, type, priority });
        }
        logger_1.default.info(`Notification sent to user ${userId}: ${title}`);
        if (senderId) {
            await prisma_1.default.activityLog.create({
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
    static async sendBulkNotification(data, senderId) {
        const { title, message, type = client_1.NotificationType.GENERAL, channel = client_1.NotificationChannel.IN_APP, priority = client_1.NotificationPriority.NORMAL, target, userIds = [], roles = [], data: additionalData } = data;
        const sender = await prisma_1.default.user.findUnique({
            where: { id: senderId },
            select: { role: true }
        });
        if (!sender || sender.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can send bulk notifications");
        }
        let targetUsers = [];
        switch (target) {
            case 'ALL':
                targetUsers = await prisma_1.default.user.findMany({
                    where: { isVerified: true, isSuspended: false },
                    select: { id: true, email: true, fullName: true }
                });
                break;
            case 'VENDOR':
                targetUsers = await prisma_1.default.user.findMany({
                    where: { role: client_1.Role.VENDOR, isVerified: true, isSuspended: false },
                    select: { id: true, email: true, fullName: true }
                });
                break;
            case 'USER':
                targetUsers = await prisma_1.default.user.findMany({
                    where: { role: client_1.Role.USER, isVerified: true, isSuspended: false },
                    select: { id: true, email: true, fullName: true }
                });
                break;
            case 'STAFF':
                targetUsers = await prisma_1.default.user.findMany({
                    where: { role: client_1.Role.STAFF, isVerified: true, isSuspended: false },
                    select: { id: true, email: true, fullName: true }
                });
                break;
            case 'SPECIFIC':
                if (!userIds || userIds.length === 0) {
                    throw new BadRequestError_1.BadRequestError("User IDs are required for specific target");
                }
                targetUsers = await prisma_1.default.user.findMany({
                    where: {
                        id: { in: userIds },
                        isVerified: true,
                        isSuspended: false
                    },
                    select: { id: true, email: true, fullName: true }
                });
                break;
            default:
                throw new BadRequestError_1.BadRequestError("Invalid target type");
        }
        if (targetUsers.length === 0) {
            throw new BadRequestError_1.BadRequestError("No users found for the specified target");
        }
        // Generate bulk ID for tracking
        const bulkId = (0, uuid_1.v4)();
        // Create bulk notification record
        const bulkNotification = await prisma_1.default.bulkNotification.create({
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
                const notification = await prisma_1.default.notification.create({
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
                if (channel === client_1.NotificationChannel.EMAIL || channel === client_1.NotificationChannel.BOTH) {
                    try {
                        await this.sendEmailNotification(user, { title, message, type, priority });
                        deliveredCount++;
                    }
                    catch (emailError) {
                        logger_1.default.error(`Failed to send email to ${user.email}:`, emailError);
                        failedCount++;
                    }
                }
                else {
                    deliveredCount++;
                }
            }
            catch (error) {
                logger_1.default.error(`Failed to send notification to ${user.id}:`, error);
                failedCount++;
            }
        }
        // Update bulk notification stats
        await prisma_1.default.bulkNotification.update({
            where: { id: bulkNotification.id },
            data: {
                sentCount,
                deliveredCount,
                failedCount
            }
        });
        logger_1.default.info(`Bulk notification sent to ${sentCount} users, ${deliveredCount} delivered, ${failedCount} failed`);
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
    static async sendEmailNotification(user, data) {
        try {
            const { title, message, type, priority } = data;
            const emailHtml = await (0, mailTemplate_1.render)('notification-email', {
                userName: user.fullName || user.email,
                title,
                message,
                type,
                priority,
                priorityColor: this.getPriorityColor(priority),
                currentYear: new Date().getFullYear(),
                dashboardUrl: `${process.env.FRONTEND_URL}/notifications`
            });
            const mailOptions = {
                to: user.email,
                from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                subject: `Notification: ${title}`,
                text: message,
                html: emailHtml
            };
            await (0, mail_services_1.sendGraphMail)(mailOptions);
            logger_1.default.info(`Email notification sent to ${user.email}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to send email notification to ${user.email}:`, error);
            throw error;
        }
    }
    static getPriorityColor(priority) {
        switch (priority) {
            case client_1.NotificationPriority.LOW:
                return '#4CAF50';
            case client_1.NotificationPriority.NORMAL:
                return '#2196F3';
            case client_1.NotificationPriority.HIGH:
                return '#FF9800';
            case client_1.NotificationPriority.URGENT:
                return '#f44336';
            default:
                return '#2196F3';
        }
    }
    static async getUserNotifications(userId, filters) {
        const { read, type, channel, priority, page = 1, limit = 20 } = filters;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = { userId };
        if (read !== undefined)
            where.read = read;
        if (type)
            where.type = type;
        if (channel)
            where.channel = channel;
        if (priority)
            where.priority = priority;
        const [notifications, total, unreadCount] = await Promise.all([
            prisma_1.default.notification.findMany({
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
            prisma_1.default.notification.count({ where }),
            prisma_1.default.notification.count({
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
    static async markAsRead(notificationId, userId) {
        const notification = await prisma_1.default.notification.findUnique({
            where: { id: notificationId }
        });
        if (!notification) {
            throw new NotFoundError_1.NotFoundError("Notification not found");
        }
        if (notification.userId !== userId) {
            throw new ForbiddenError_1.ForbiddenError("You can only mark your own notifications as read");
        }
        const updated = await prisma_1.default.notification.update({
            where: { id: notificationId },
            data: {
                read: true,
                readAt: new Date()
            }
        });
        return updated;
    }
    static async markAllAsRead(userId) {
        const result = await prisma_1.default.notification.updateMany({
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
    static async getNotificationStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now);
        thisWeek.setDate(now.getDate() - now.getDay());
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalNotifications, totalRead, totalUnread, todayNotifications, thisWeekNotifications, thisMonthNotifications, byChannel, byPriority, byType, recentBulk] = await Promise.all([
            prisma_1.default.notification.count(),
            prisma_1.default.notification.count({ where: { read: true } }),
            prisma_1.default.notification.count({ where: { read: false } }),
            prisma_1.default.notification.count({ where: { createdAt: { gte: today } } }),
            prisma_1.default.notification.count({ where: { createdAt: { gte: thisWeek } } }),
            prisma_1.default.notification.count({ where: { createdAt: { gte: thisMonth } } }),
            prisma_1.default.notification.groupBy({
                by: ['channel'],
                _count: true
            }),
            prisma_1.default.notification.groupBy({
                by: ['priority'],
                _count: true
            }),
            prisma_1.default.notification.groupBy({
                by: ['type'],
                _count: true,
                orderBy: { _count: { type: 'desc' } },
                take: 10
            }),
            prisma_1.default.bulkNotification.findMany({
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
            recentBulk: recentBulk.map((b) => ({
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
    static async deleteNotification(notificationId, userId) {
        const notification = await prisma_1.default.notification.findUnique({
            where: { id: notificationId }
        });
        if (!notification) {
            throw new NotFoundError_1.NotFoundError("Notification not found");
        }
        if (notification.userId !== userId) {
            throw new ForbiddenError_1.ForbiddenError("You can only delete your own notifications");
        }
        await prisma_1.default.notification.delete({
            where: { id: notificationId }
        });
    }
    /**
     * Get bulk notification details
     */
    static async getBulkNotificationDetails(bulkId) {
        const bulk = await prisma_1.default.bulkNotification.findUnique({
            where: { bulkId }
        });
        if (!bulk) {
            throw new NotFoundError_1.NotFoundError("Bulk notification not found");
        }
        const notifications = await prisma_1.default.notification.findMany({
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
exports.NotificationService = NotificationService;
