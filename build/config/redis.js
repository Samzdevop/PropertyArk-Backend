"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSubService = exports.PresenceService = exports.CacheService = exports.redisSubscriber = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: {},
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};
exports.redisClient = new ioredis_1.default(redisConfig);
exports.redisSubscriber = exports.redisClient.duplicate();
class CacheService {
    static async set(key, value, ttl) {
        const stringValue = JSON.stringify(value);
        if (ttl) {
            await exports.redisClient.setex(key, ttl, stringValue);
        }
        else {
            await exports.redisClient.set(key, stringValue);
        }
    }
    static async get(key) {
        const value = await exports.redisClient.get(key);
        return value ? JSON.parse(value) : null;
    }
    static async del(key) {
        await exports.redisClient.del(key);
    }
    static async hset(key, field, value) {
        const stringValue = JSON.stringify(value);
        await exports.redisClient.hset(key, field, stringValue);
    }
    static async hget(key, field) {
        const value = await exports.redisClient.hget(key, field);
        return value ? JSON.parse(value) : null;
    }
    static async expire(key, seconds) {
        await exports.redisClient.expire(key, seconds);
    }
    static async hincrby(key, field, value) {
        return exports.redisClient.hincrby(key, field, value);
    }
}
exports.CacheService = CacheService;
class PresenceService {
    static ONLINE_TTL = 300;
    static async setOnline(userId) {
        await CacheService.set(`presence:${userId}`, 'online', this.ONLINE_TTL);
    }
    static async setOffline(userId) {
        await CacheService.del(`presence:${userId}`);
    }
    static async isOnline(userId) {
        const status = await CacheService.get(`presence:${userId}`);
        return status === 'online';
    }
    static async getUserStatus(userId) {
        const isOnline = await this.isOnline(userId);
        return isOnline ? 'online' : 'offline';
    }
    static async getOnlineUsers(userIds) {
        const onlineUsers = [];
        for (const userId of userIds) {
            if (await this.isOnline(userId)) {
                onlineUsers.push(userId);
            }
        }
        return onlineUsers;
    }
}
exports.PresenceService = PresenceService;
class PubSubService {
    static async publish(channel, message) {
        await exports.redisClient.publish(channel, JSON.stringify(message));
    }
    static async subscribe(channel, callback) {
        exports.redisSubscriber.subscribe(channel, (err, count) => {
            if (err)
                console.error('Failed to subscribe:', err);
        });
        exports.redisSubscriber.on('message', (chan, message) => {
            if (chan === channel) {
                callback(JSON.parse(message));
            }
        });
    }
    static async unsubscribe(channel) {
        await exports.redisSubscriber.unsubscribe(channel);
    }
}
exports.PubSubService = PubSubService;
