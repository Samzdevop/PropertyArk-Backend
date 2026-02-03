import axios from 'axios';
import prisma from '../prisma';
import { NotificationService } from './notification.services';
import { NotificationType } from '@prisma/client';

export class PushService {
  static async sendPushNotification(
    messageId: string,
    recipientIds: string[]
  ) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        conversation: true,
      },
    });

    if (!message) return;

    for (const recipientId of recipientIds) {
      const user = await prisma.user.findUnique({
        where: { id: recipientId },
        select: {
          fcmToken: true,
          fullName: true,
        },
      });

      // 🚫 No push token → skip
      if (!user?.fcmToken) continue;

      // Respect notification settings
      const shouldSend = await NotificationService.shouldSendNotification(
        recipientId,
        'MESSAGE'
      );

      if (!shouldSend) continue;

      // 🔔 Send push via OneSignal
      await axios.post(
        'https://onesignal.com/api/v1/notifications',
        {
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
        },
        {
          headers: {
            Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 📥 Save in-app notification
      await NotificationService.createNotification({
        recipientId,
        title: 'New Message',
        message: message.content,
        type: NotificationType.MESSAGE,
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
