import Queue from 'bull';
import { redisClient } from '../config/redis';
import prisma from '../prisma';
import { PushService } from '../services/push.service';
import { NotificationService } from '../services/notification.services';
import { CacheService } from '../config/redis';


export const messageQueue = new Queue('message-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: false
  }
});

// Separate queues for different tasks
export const notificationQueue = new Queue('notification-processing', {
  redis: redisClient.options,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50
  }
});

export const analyticsQueue = new Queue('analytics-processing', {
  redis: redisClient.options,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true
  }
});

// Processors
messageQueue.process('send_message', async (job) => {
  const { messageId, conversationId, senderId, recipientIds } = job.data;
  await processMessageSend(messageId, conversationId, senderId, recipientIds);
});

messageQueue.process('update_status', async (job) => {
  const { messageId, status, recipientId } = job.data;
  await processStatusUpdate(messageId, status, recipientId);
});

notificationQueue.process('send_push', async (job) => {
  const { messageId, recipientIds } = job.data;
  await PushService.sendPushNotification(messageId, recipientIds);
});

notificationQueue.process('send_email', async (job) => {
  const { messageId, recipientIds } = job.data;
  await NotificationService.sendMessageEmailNotification(messageId, recipientIds);
});

analyticsQueue.process('message_analytics', async (job) => {
  const { senderId, conversationId, timestamp } = job.data;
  await processMessageAnalytics(senderId, conversationId, timestamp);
});

analyticsQueue.process('read_analytics', async (job) => {
  const { userId, messageCount, timestamp } = job.data;
  await processReadAnalytics(userId, messageCount, timestamp);
});

// Helper functions
async function processMessageSend(
  messageId: string,
  conversationId: string,
  senderId: string,
  recipientIds: string[]
) {
  try {
    // 1. Send push notifications
    await notificationQueue.add('send_push', {
      messageId,
      recipientIds
    });

    // 2. Send email notifications
    await notificationQueue.add('send_email', {
      messageId,
      recipientIds
    });

    // 3. Index message for search
    await indexMessageForSearch(messageId);

    // 4. Update analytics
    await analyticsQueue.add('message_analytics', {
      senderId,
      conversationId,
      timestamp: new Date()
    });

    // 5. Update message cache
    await CacheService.set(`message:${messageId}:processed`, true, 3600);

  } catch (error) {
    console.error('Error processing message send:', error);
    throw error;
  }
}

async function processStatusUpdate(messageId: string, status: string, recipientId: string) {
  try {
    await prisma.messageDelivery.updateMany({
      where: {
        messageId,
        recipientId
      },
      data: {
        status: status as any,
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
        ...(status === 'READ' && { readAt: new Date() })
      }
    });

    // Cache delivery status
    await CacheService.hset(`message:${messageId}:delivery`, recipientId, {
      status,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error processing status update:', error);
    throw error;
  }
}

async function indexMessageForSearch(messageId: string) {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        senderId: true,
        conversationId: true,
        createdAt: true,
        messageType: true
      }
    });

    if (!message) return;

    // Index in Redis
    await CacheService.set(`search:message:${messageId}`, message, 86400 * 7); // 7 days

    // Optional: Index in Elasticsearch
    if (process.env.ELASTICSEARCH_URL) {
      // Implement Elasticsearch indexing
    }

  } catch (error) {
    console.error('Error indexing message:', error);
  }
}

async function processMessageAnalytics(senderId: string, conversationId: string, timestamp: Date) {
  try {
    // Update user message count
    await CacheService.hincrby(`analytics:user:${senderId}`, 'messages_sent', 1);
    
    // Update conversation activity
    const hour = timestamp.getHours();
    await CacheService.hincrby(`analytics:conversation:${conversationId}:hour:${hour}`, 'messages', 1);
    
    // Update daily stats
    const dayKey = `analytics:daily:${timestamp.toISOString().split('T')[0]}`;
    await CacheService.hincrby(dayKey, 'total_messages', 1);

  } catch (error) {
    console.error('Error processing message analytics:', error);
  }
}

async function processReadAnalytics(userId: string, messageCount: number, timestamp: Date) {
  try {
    // Update read statistics
    await CacheService.hincrby(`analytics:user:${userId}`, 'messages_read', messageCount);
    
    // Calculate average read time (simplified)
    const readStats = await CacheService.hget(`analytics:user:${userId}:read`, 'stats') || {
      totalMessages: 0,
      totalReadTime: 0
    };
    
    readStats.totalMessages += messageCount;
    readStats.totalReadTime += messageCount * 5; // Assume 5 seconds per message
    
    await CacheService.hset(`analytics:user:${userId}:read`, 'stats', readStats);

  } catch (error) {
    console.error('Error processing read analytics:', error);
  }
}

// Queue helper class
export class MessageQueue {
  static async queueMessageSend(data: any) {
    return await messageQueue.add('send_message', data, {
      priority: 1,
      timeout: 10000
    });
  }

  static async queueStatusUpdate(data: any) {
    return await messageQueue.add('update_status', data, {
      priority: 2
    });
  }

  static async queuePushNotification(data: any) {
    return await notificationQueue.add('send_push', data, {
      priority: 3
    });
  }

  static async queueEmailNotification(data: any) {
    return await notificationQueue.add('send_email', data, {
      priority: 4
    });
  }

  static async queueMessageAnalytics(data: any) {
    return await analyticsQueue.add('message_analytics', data, {
      priority: 5
    });
  }

  static async queueReadAnalytics(data: any) {
    return await analyticsQueue.add('read_analytics', data, {
      priority: 6
    });
  }
}