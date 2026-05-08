import Redis from 'ioredis';

/**
 * createRedisClient
 * Factory function that creates and returns an ioredis client
 * configured from environment variables.
 * lazyConnect=true means it does NOT connect immediately —
 * call client.connect() or the first command will trigger the connection.
 */
export function createRedisClient(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
  });
}
