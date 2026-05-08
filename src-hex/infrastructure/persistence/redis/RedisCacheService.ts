import Redis from 'ioredis';
import { ICacheService } from '../../../application/ports/output/ICacheService';

/**
 * RedisCacheService
 * Implementation of ICacheService using ioredis
 * Handles JSON serialization/deserialization transparently
 */
export class RedisCacheService<T = any> implements ICacheService<T> {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async getMany(keys: string[]): Promise<Map<string, T>> {
    if (keys.length === 0) return new Map();
    const values = await this.redis.mget(...keys);
    const result = new Map<string, T>();
    keys.forEach((key, idx) => {
      const raw = values[idx];
      if (raw !== null) {
        try {
          result.set(key, JSON.parse(raw) as T);
        } catch {
          result.set(key, raw as unknown as T);
        }
      }
    });
    return result;
  }

  async setMany(entries: Map<string, T>, ttlSeconds?: number): Promise<void> {
    if (entries.size === 0) return;
    const pipeline = this.redis.pipeline();
    entries.forEach((value, key) => {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        pipeline.setex(key, ttlSeconds, serialized);
      } else {
        pipeline.set(key, serialized);
      }
    });
    await pipeline.exec();
  }
}
