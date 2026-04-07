import Redis, { RedisOptions } from 'ioredis';
import { Config } from '../config';
import { Logger } from '../utils/logger';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    const host = Config.get('redis.host', 'localhost') as string;
    const port = Config.get('redis.port', 6379) as number;
    const password = Config.get('redis.password', undefined) as string | undefined;

    const options: RedisOptions = {
      host,
      port,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    if (password) {
      options.password = password;
    }

    redisInstance = new Redis(options);

    redisInstance.on('error', (err: Error) => {
      Logger.error('Redis connection error', err);
    });

    redisInstance.on('connect', () => {
      Logger.info('Redis connected');
    });

    redisInstance.on('ready', () => {
      Logger.info('Redis ready');
    });
  }

  return redisInstance;
}

export async function initRedis(): Promise<void> {
  const redis = getRedisClient();
  await redis.ping();
  Logger.info('Redis initialized successfully');
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    Logger.info('Redis disconnected');
  }
}

export function isRedisAvailable(): boolean {
  return redisInstance !== null && redisInstance.status === 'ready';
}