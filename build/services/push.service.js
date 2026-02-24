"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../prisma"));
const notification_services_1 = require("./notification.services");
const client_1 = require("@prisma/client");
class PushService {
    static async sendPushNotification(messageId, recipientIds) {
        const message = await prisma_1.default.message.findUnique({
            where: { id: messageId },
            include: {
                sender: true,
                conversation: true,
            },
        });
        if (!message)
            return;
        for (const recipientId of recipientIds) {
            const user = await prisma_1.default.user.findUnique({
                where: { id: recipientId },
                select: {
                    fcmToken: true,
                    fullName: true,
                },
            });
            // 🚫 No push token → skip
            if (!user?.fcmToken)
                continue;
            // Respect notification settings
            const shouldSend = await notification_services_1.NotificationService.shouldSendNotification(recipientId, 'MESSAGE');
            if (!shouldSend)
                continue;
            // 🔔 Send push via OneSignal
            await axios_1.default.post('https://onesignal.com/api/v1/notifications', {
                app_id: process.env.ONESIGNAL_APP_ID,
                // 👇 Store OneSignal player ID in fcmToken
                include_player_ids: [user.fcmToken],
                headings: { en: `New message from ${message.sender.fullName}` },
                contents: { en: message.content },
                data: {
                    messageId,
                    conversationId: message.conversationId,
                    senderId: message.senderId,
                    type: 'MESSAGE',
                },
            }, {
                headers: {
                    Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });
            // 📥 Save in-app notification
            await notification_services_1.NotificationService.createNotification({
                recipientId,
                title: 'New Message',
                message: message.content,
                type: client_1.NotificationType.MESSAGE,
                relatedEntityType: 'MESSAGE',
                relatedEntityId: messageId,
                metadata: {
                    conversationId: message.conversationId,
                    senderId: message.senderId,
                },
            });
        }
    }
}
exports.PushService = PushService;
