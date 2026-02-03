import Redis from 'ioredis';


const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: {},
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};
export const redisClient = new Redis(redisConfig);
export const redisSubscriber = redisClient.duplicate();

export class CacheService {
  static async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
  }

  static async get<T = any>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  static async del(key: string): Promise<void> {
    await redisClient.del(key);
  }

  static async hset(key: string, field: string, value: any): Promise<void> {
    const stringValue = JSON.stringify(value);
    await redisClient.hset(key, field, stringValue);
  }

  static async hget<T = any>(key: string, field: string): Promise<T | null> {
    const value = await redisClient.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  static async expire(key: string, seconds: number): Promise<void> {
    await redisClient.expire(key, seconds);
  }

  static async hincrby(key: string, field: string, value: number) {
    return redisClient.hincrby(key, field, value);
  }
}


export class PresenceService {
  private static readonly ONLINE_TTL = 300;

  static async setOnline(userId: string): Promise<void> {
    await CacheService.set(`presence:${userId}`, 'online', this.ONLINE_TTL);
  }

  static async setOffline(userId: string): Promise<void> {
    await CacheService.del(`presence:${userId}`);
  }

  static async isOnline(userId: string): Promise<boolean> {
    const status = await CacheService.get<string>(`presence:${userId}`);
    return status === 'online';
  }

  static async getUserStatus(userId: string): Promise<'online' | 'offline'> {
    const isOnline = await this.isOnline(userId);
    return isOnline ? 'online' : 'offline';
  }

  static async getOnlineUsers(userIds: string[]): Promise<string[]> {
    const onlineUsers: string[] = [];
    for (const userId of userIds) {
      if (await this.isOnline(userId)) {
        onlineUsers.push(userId);
      }
    }
    return onlineUsers;
  }
}


export class PubSubService {
  static async publish(channel: string, message: any): Promise<void> {
    await redisClient.publish(channel, JSON.stringify(message));
  }

  static async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    redisSubscriber.subscribe(channel, (err, count) => {
      if (err) console.error('Failed to subscribe:', err);
    });
    
    redisSubscriber.on('message', (chan, message) => {
      if (chan === channel) {
        callback(JSON.parse(message));
      }
    });
  }

  static async unsubscribe(channel: string): Promise<void> {
    await redisSubscriber.unsubscribe(channel);
  }
}
