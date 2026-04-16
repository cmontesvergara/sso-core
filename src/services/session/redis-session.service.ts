import { isRedisAvailable, getRedisClient } from '../redis';

interface SessionData {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  [key: string]: any;
}

/**
 * RedisSessionService
 * Handles Redis operations for sessions
 * Single Responsibility: Redis cache layer for sessions
 */
export class RedisSessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly REVOKED_PREFIX = 'revoked:';
  private readonly REFRESH_PREFIX = 'refresh:';
  private readonly FAMILY_PREFIX = 'refresh_family:';
  private readonly PERMISSIONS_PREFIX = 'permissions:';

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return isRedisAvailable();
  }

  /**
   * Save a session to Redis
   */
  async saveSession(
    jti: string,
    userId: string,
    data: SessionData,
    ttlSeconds: number,
    sessionType: 'sso' | 'app'
  ): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.SESSION_PREFIX}${sessionType}:${jti}`;

    const sessionData = {
      jti,
      userId,
      ...data,
      sessionType,
    };

    await redis.setex(key, ttlSeconds, JSON.stringify(sessionData));
  }

  /**
   * Get a session from Redis
   */
  async getSession(jti: string, sessionType: 'sso' | 'app'): Promise<SessionData | null> {
    const redis = getRedisClient();
    const key = `${this.SESSION_PREFIX}${sessionType}:${jti}`;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Revoke a session in Redis
   */
  async revokeSession(jti: string, userId?: string): Promise<void> {
    const redis = getRedisClient();

    // Mark as revoked
    await redis.setex(`${this.REVOKED_PREFIX}${jti}`, 3600, '1');

    // Delete session data
    await redis.del(`${this.SESSION_PREFIX}sso:${jti}`);
    await redis.del(`${this.SESSION_PREFIX}app:${jti}`);

    // If userId provided, also track by user
    if (userId) {
      await redis.sadd(`user_sessions:${userId}`, jti);
      await redis.expire(`user_sessions:${userId}`, 3600);
    }
  }

  /**
   * Check if a session is revoked
   */
  async isSessionRevoked(jti: string): Promise<boolean> {
    const redis = getRedisClient();
    const revoked = await redis.get(`${this.REVOKED_PREFIX}${jti}`);
    return revoked === '1';
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const redis = getRedisClient();

    // Get all session JTIs for this user
    const sessionKeys = await redis.keys(`${this.SESSION_PREFIX}*:${userId}`);
    if (sessionKeys.length > 0) {
      await redis.del(...sessionKeys);
    }

    // Mark all as revoked
    const userSessions = await redis.smembers(`user_sessions:${userId}`);
    for (const jti of userSessions) {
      await redis.setex(`${this.REVOKED_PREFIX}${jti}`, 3600, '1');
    }

    await redis.del(`user_sessions:${userId}`);
  }

  /**
   * Save refresh token metadata to Redis
   */
  async saveRefreshToken(
    tokenHash: string,
    data: {
      userId: string;
      jti: string;
      familyId: string;
      createdAt: number;
    },
    ttlSeconds: number
  ): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.REFRESH_PREFIX}${tokenHash}`;

    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  }

  /**
   * Get refresh token metadata from Redis
   */
  async getRefreshToken(tokenHash: string): Promise<{
    userId: string;
    jti: string;
    familyId: string;
    createdAt: number;
  } | null> {
    const redis = getRedisClient();
    const key = `${this.REFRESH_PREFIX}${tokenHash}`;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Delete a refresh token from Redis
   */
  async deleteRefreshToken(tokenHash: string): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.REFRESH_PREFIX}${tokenHash}`;
    await redis.del(key);
  }

  /**
   * Mark a refresh token family as used
   */
  async markRefreshTokenFamilyUsed(familyId: string): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.FAMILY_PREFIX}${familyId}`;
    // Set with short TTL (cleanup happens naturally)
    await redis.setex(key, 3600, '1');
  }

  /**
   * Check if a refresh token family has been used
   */
  async isRefreshTokenFamilyUsed(familyId: string): Promise<boolean> {
    const redis = getRedisClient();
    const key = `${this.FAMILY_PREFIX}${familyId}`;
    const used = await redis.get(key);
    return used === '1';
  }

  /**
   * Cache permissions for quick access
   */
  async cachePermissions(
    jti: string,
    permissions: Array<{ resource: string; action: string }>,
    ttlSeconds: number
  ): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.PERMISSIONS_PREFIX}${jti}`;

    await redis.setex(key, ttlSeconds, JSON.stringify(permissions));
  }

  /**
   * Get cached permissions
   */
  async getPermissions(jti: string): Promise<Array<{ resource: string; action: string }> | null> {
    const redis = getRedisClient();
    const key = `${this.PERMISSIONS_PREFIX}${jti}`;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Delete cached permissions
   */
  async deletePermissions(jti: string): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.PERMISSIONS_PREFIX}${jti}`;
    await redis.del(key);
  }
}
