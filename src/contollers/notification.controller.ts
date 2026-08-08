import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotificationService } from "../services/notification.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role, NotificationChannel, NotificationPriority } from "@prisma/client";


export const sendToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const admin = req.user as any;

    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can send notifications");
    }

    const { userId, title, message, type, channel, priority, data } = req.body;

    const notification = await NotificationService.sendToUser(
      userId,
      { title, message, type, channel, priority, data },
      admin.id
    );

    await logActivity(
      admin.id,
      'SEND_NOTIFICATION_TO_USER',
      'NOTIFICATION',
      notification.id,
      {
        recipientId: userId,
        title,
        channel,
        priority
      },
      req
    );

    sendSuccessResponse(res, "Notification sent successfully", notification);
  } catch (error) {
    next(error);
  }
};


export const sendBulkNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const admin = req.user as any;

    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can send bulk notifications");
    }

    const {
      title,
      message,
      type,
      channel = NotificationChannel.IN_APP,
      priority = NotificationPriority.NORMAL,
      target,
      userIds,
      roles,
      data
    } = req.body;

    const result = await NotificationService.sendBulkNotification(
      {
        title,
        message,
        type,
        channel,
        priority,
        target,
        userIds,
        roles,
        data
      },
      admin.id
    );

    await logActivity(
      admin.id,
      'SEND_BULK_NOTIFICATION',
      'NOTIFICATION',
      result.bulkId,
      {
        target,
        sentCount: result.sentCount,
        deliveredCount: result.deliveredCount,
        failedCount: result.failedCount,
        title,
        channel,
        priority
      },
      req
    );

    sendSuccessResponse(res, "Bulk notification sent successfully", result);
  } catch (error) {
    next(error);
  }
};


export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { read, type, channel, priority, page = 1, limit = 20 } = req.query;

    const result = await NotificationService.getUserNotifications(
      user.id,
      {
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        type: type as any,
        channel: channel as any,
        priority: priority as any,
        page: Number(page),
        limit: Number(limit)
      }
    );

    sendSuccessResponse(res, "Notifications retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};


export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { notificationId } = req.params;

    const notification = await NotificationService.markAsRead(
      notificationId as string,
      user.id
    );

    await logActivity(
      user.id,
      'MARK_NOTIFICATION_READ',
      'NOTIFICATION',
      notificationId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Notification marked as read", notification);
  } catch (error) {
    next(error);
  }
};


export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    const result = await NotificationService.markAllAsRead(user.id);

    await logActivity(
      user.id,
      'MARK_ALL_NOTIFICATIONS_READ',
      'NOTIFICATION',
      'all',
      { count: result.count },
      req
    );

    sendSuccessResponse(res, "All notifications marked as read", result);
  } catch (error) {
    next(error);
  }
};


export const getNotificationStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view notification statistics");
    }

    const stats = await NotificationService.getNotificationStats();

    await logActivity(
      user.id,
      'VIEW_NOTIFICATION_STATS',
      'NOTIFICATION',
      'stats',
      {},
      req
    );

    sendSuccessResponse(res, "Notification statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};


export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { notificationId } = req.params;

    await NotificationService.deleteNotification(
      notificationId as string,
      user.id
    );

    await logActivity(
      user.id,
      'DELETE_NOTIFICATION',
      'NOTIFICATION',
      notificationId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Notification deleted successfully");
  } catch (error) {
    next(error);
  }
};


export const getBulkNotificationDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view bulk notification details");
    }

    const { bulkId } = req.params;

    const details = await NotificationService.getBulkNotificationDetails(
      bulkId as string
    );

    sendSuccessResponse(res, "Bulk notification details retrieved successfully", details);
  } catch (error) {
    next(error);
  }
};