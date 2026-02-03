"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageQueue = exports.analyticsQueue = exports.notificationQueue = exports.messageQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const redis_1 = require("../config/redis");
const prisma_1 = __importDefault(require("../prisma"));
const push_service_1 = require("../services/push.service");
const notification_services_1 = require("../services/notification.services");
const redis_2 = require("../config/redis");
exports.messageQueue = new bull_1.default('message-processing', {
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
exports.notificationQueue = new bull_1.default('notification-processing', {
    redis: redis_1.redisClient.options,
    defaultJobOptions: {
        attempts: 2,
        removeOnComplete: 50
    }
});
exports.analyticsQueue = new bull_1.default('analytics-processing', {
    redis: redis_1.redisClient.options,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true
    }
});
// Processors
exports.messageQueue.process('send_message', async (job) => {
    const { messageId, conversationId, senderId, recipientIds } = job.data;
    await processMessageSend(messageId, conversationId, senderId, recipientIds);
});
exports.messageQueue.process('update_status', async (job) => {
    const { messageId, status, recipientId } = job.data;
    await processStatusUpdate(messageId, status, recipientId);
});
exports.notificationQueue.process('send_push', async (job) => {
    const { messageId, recipientIds } = job.data;
    await push_service_1.PushService.sendPushNotification(messageId, recipientIds);
});
exports.notificationQueue.process('send_email', async (job) => {
    const { messageId, recipientIds } = job.data;
    await notification_services_1.NotificationService.sendMessageEmailNotification(messageId, recipientIds);
});
exports.analyticsQueue.process('message_analytics', async (job) => {
    const { senderId, conversationId, timestamp } = job.data;
    await processMessageAnalytics(senderId, conversationId, timestamp);
});
exports.analyticsQueue.process('read_analytics', async (job) => {
    const { userId, messageCount, timestamp } = job.data;
    await processReadAnalytics(userId, messageCount, timestamp);
});
// Helper functions
async function processMessageSend(messageId, conversationId, senderId, recipientIds) {
    try {
        // 1. Send push notifications
        await exports.notificationQueue.add('send_push', {
            messageId,
            recipientIds
        });
        // 2. Send email notifications
        await exports.notificationQueue.add('send_email', {
            messageId,
            recipientIds
        });
        // 3. Index message for search
        await indexMessageForSearch(messageId);
        // 4. Update analytics
        await exports.analyticsQueue.add('message_analytics', {
            senderId,
            conversationId,
            timestamp: new Date()
        });
        // 5. Update message cache
        await redis_2.CacheService.set(`message:${messageId}:processed`, true, 3600);
    }
    catch (error) {
        console.error('Error processing message send:', error);
        throw error;
    }
}
async function processStatusUpdate(messageId, status, recipientId) {
    try {
        await prisma_1.default.messageDelivery.updateMany({
            where: {
                messageId,
                recipientId
            },
            data: {
                status: status,
                ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
                ...(status === 'READ' && { readAt: new Date() })
            }
        });
        // Cache delivery status
        await redis_2.CacheService.hset(`message:${messageId}:delivery`, recipientId, {
            status,
            timestamp: new Date()
        });
    }
    catch (error) {
        console.error('Error processing status update:', error);
        throw error;
    }
}
async function indexMessageForSearch(messageId) {
    try {
        const message = await prisma_1.default.message.findUnique({
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
        if (!message)
            return;
        // Index in Redis
        await redis_2.CacheService.set(`search:message:${messageId}`, message, 86400 * 7); // 7 days
        // Optional: Index in Elasticsearch
        if (process.env.ELASTICSEARCH_URL) {
            // Implement Elasticsearch indexing
        }
    }
    catch (error) {
        console.error('Error indexing message:', error);
    }
}
async function processMessageAnalytics(senderId, conversationId, timestamp) {
    try {
        // Update user message count
        await redis_2.CacheService.hincrby(`analytics:user:${senderId}`, 'messages_sent', 1);
        // Update conversation activity
        const hour = timestamp.getHours();
        await redis_2.CacheService.hincrby(`analytics:conversation:${conversationId}:hour:${hour}`, 'messages', 1);
        // Update daily stats
        const dayKey = `analytics:daily:${timestamp.toISOString().split('T')[0]}`;
        await redis_2.CacheService.hincrby(dayKey, 'total_messages', 1);
    }
    catch (error) {
        console.error('Error processing message analytics:', error);
    }
}
async function processReadAnalytics(userId, messageCount, timestamp) {
    try {
        // Update read statistics
        await redis_2.CacheService.hincrby(`analytics:user:${userId}`, 'messages_read', messageCount);
        // Calculate average read time (simplified)
        const readStats = await redis_2.CacheService.hget(`analytics:user:${userId}:read`, 'stats') || {
            totalMessages: 0,
            totalReadTime: 0
        };
        readStats.totalMessages += messageCount;
        readStats.totalReadTime += messageCount * 5; // Assume 5 seconds per message
        await redis_2.CacheService.hset(`analytics:user:${userId}:read`, 'stats', readStats);
    }
    catch (error) {
        console.error('Error processing read analytics:', error);
    }
}
// Queue helper class
class MessageQueue {
    static async queueMessageSend(data) {
        return await exports.messageQueue.add('send_message', data, {
            priority: 1,
            timeout: 10000
        });
    }
    static async queueStatusUpdate(data) {
        return await exports.messageQueue.add('update_status', data, {
            priority: 2
        });
    }
    static async queuePushNotification(data) {
        return await exports.notificationQueue.add('send_push', data, {
            priority: 3
        });
    }
    static async queueEmailNotification(data) {
        return await exports.notificationQueue.add('send_email', data, {
            priority: 4
        });
    }
    static async queueMessageAnalytics(data) {
        return await exports.analyticsQueue.add('message_analytics', data, {
            priority: 5
        });
    }
    static async queueReadAnalytics(data) {
        return await exports.analyticsQueue.add('read_analytics', data, {
            priority: 6
        });
    }
}
exports.MessageQueue = MessageQueue;
