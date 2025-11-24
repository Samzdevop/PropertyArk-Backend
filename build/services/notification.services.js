"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class NotificationService {
    static async shouldSendNotification(userId, notificationType) {
        const settings = await prisma_1.default.notificationSettings.findUnique({
            where: { userId }
        });
        // If no settings exist, default to sending all notifications
        if (!settings) {
            return true;
        }
        switch (notificationType) {
            case 'FOLLOW_UP_REMINDER':
            case 'TREATMENT_REMINDER':
                return settings.followUpReminders;
            case 'APPOINTMENT_REMINDER':
                return settings.upcomingAppointments;
            case 'TASK_ASSIGNED':
            case 'ANNOUNCEMENT':
            case 'MESSAGE':
                return settings.messageNotifications;
            case 'SYSTEM_ALERT':
                return true; // Always send system alerts
            default:
                return true;
        }
    }
    static async createNotification(notificationData) {
        try {
            const shouldSend = await this.shouldSendNotification(notificationData.recipientId, notificationData.type);
            if (!shouldSend) {
                console.log(`Notification skipped for user ${notificationData.recipientId} - type: ${notificationData.type}`);
                return null;
            }
            const notification = await prisma_1.default.notification.create({
                data: notificationData
            });
            console.log(`Notification sent to user ${notificationData.recipientId} - type: ${notificationData.type}`);
            return notification;
        }
        catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }
    static async getUserNotificationSettings(userId) {
        let settings = await prisma_1.default.notificationSettings.findUnique({
            where: { userId }
        });
        if (!settings) {
            settings = await prisma_1.default.notificationSettings.create({
                data: {
                    userId,
                    followUpReminders: true,
                    upcomingAppointments: true,
                    messageNotifications: true
                }
            });
        }
        return settings;
    }
}
exports.NotificationService = NotificationService;
