"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBulkNotificationDetails = exports.deleteNotification = exports.getNotificationStats = exports.markAllAsRead = exports.markAsRead = exports.getMyNotifications = exports.sendBulkNotification = exports.sendToUser = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const notification_service_1 = require("../services/notification.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const sendToUser = async (req, res, next) => {
    try {
        const admin = req.user;
        if (admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can send notifications");
        }
        const { userId, title, message, type, channel, priority, data } = req.body;
        const notification = await notification_service_1.NotificationService.sendToUser(userId, { title, message, type, channel, priority, data }, admin.id);
        await (0, activity_controller_1.logActivity)(admin.id, 'SEND_NOTIFICATION_TO_USER', 'NOTIFICATION', notification.id, {
            recipientId: userId,
            title,
            channel,
            priority
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Notification sent successfully", notification);
    }
    catch (error) {
        next(error);
    }
};
exports.sendToUser = sendToUser;
const sendBulkNotification = async (req, res, next) => {
    try {
        const admin = req.user;
        if (admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can send bulk notifications");
        }
        const { title, message, type, channel = client_1.NotificationChannel.IN_APP, priority = client_1.NotificationPriority.NORMAL, target, userIds, roles, data } = req.body;
        const result = await notification_service_1.NotificationService.sendBulkNotification({
            title,
            message,
            type,
            channel,
            priority,
            target,
            userIds,
            roles,
            data
        }, admin.id);
        await (0, activity_controller_1.logActivity)(admin.id, 'SEND_BULK_NOTIFICATION', 'NOTIFICATION', result.bulkId, {
            target,
            sentCount: result.sentCount,
            deliveredCount: result.deliveredCount,
            failedCount: result.failedCount,
            title,
            channel,
            priority
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Bulk notification sent successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.sendBulkNotification = sendBulkNotification;
const getMyNotifications = async (req, res, next) => {
    try {
        const user = req.user;
        const { read, type, channel, priority, page = 1, limit = 20 } = req.query;
        const result = await notification_service_1.NotificationService.getUserNotifications(user.id, {
            read: read === 'true' ? true : read === 'false' ? false : undefined,
            type: type,
            channel: channel,
            priority: priority,
            page: Number(page),
            limit: Number(limit)
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Notifications retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyNotifications = getMyNotifications;
const markAsRead = async (req, res, next) => {
    try {
        const user = req.user;
        const { notificationId } = req.params;
        const notification = await notification_service_1.NotificationService.markAsRead(notificationId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'MARK_NOTIFICATION_READ', 'NOTIFICATION', notificationId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Notification marked as read", notification);
    }
    catch (error) {
        next(error);
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res, next) => {
    try {
        const user = req.user;
        const result = await notification_service_1.NotificationService.markAllAsRead(user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'MARK_ALL_NOTIFICATIONS_READ', 'NOTIFICATION', 'all', { count: result.count }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "All notifications marked as read", result);
    }
    catch (error) {
        next(error);
    }
};
exports.markAllAsRead = markAllAsRead;
const getNotificationStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view notification statistics");
        }
        const stats = await notification_service_1.NotificationService.getNotificationStats();
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_NOTIFICATION_STATS', 'NOTIFICATION', 'stats', {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Notification statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationStats = getNotificationStats;
const deleteNotification = async (req, res, next) => {
    try {
        const user = req.user;
        const { notificationId } = req.params;
        await notification_service_1.NotificationService.deleteNotification(notificationId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_NOTIFICATION', 'NOTIFICATION', notificationId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Notification deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNotification = deleteNotification;
const getBulkNotificationDetails = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view bulk notification details");
        }
        const { bulkId } = req.params;
        const details = await notification_service_1.NotificationService.getBulkNotificationDetails(bulkId);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Bulk notification details retrieved successfully", details);
    }
    catch (error) {
        next(error);
    }
};
exports.getBulkNotificationDetails = getBulkNotificationDetails;
