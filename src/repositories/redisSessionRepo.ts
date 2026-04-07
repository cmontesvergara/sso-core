import { getRedisClient } from '../services/redis';
import { Logger } from '../utils/logger';
import { Config } from '../config';
import type { RedisSessionData, RedisRefreshTokenData } from '../core/dtos/auth-v2.dto';

const SESSION_PREFIX = 'v2:session:';
const REFRESH_PREFIX = 'v2:refresh:';
const REVOKED_PREFIX = 'v2:revoked:';
const USER_SESSIONS_PREFIX = 'v2:user_sessions:';

function getAccessTokenExpiry(): number {
  return Config.get('v2.access_token_expiry', 900);
}

function getRefreshTokenExpiry(): number {
  return Config.get('v2.refresh_token_expiry', 7 * 24 * 60 * 60);
}

export async function initRedisSessionRepo(): Promise<void> {
  Logger.info('Redis session v2 repository initialized');
}

export async function saveRedisSession(
  jti: string,
  userId: string,
  data: Omit<RedisSessionData, 'userId' | 'createdAt'>,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedisClient();
  const ttl = ttlSeconds ?? getAccessTokenExpiry();
  const sessionData: RedisSessionData = {
    userId,
    ...data,
    createdAt: Date.now(),
  };

  const multi = redis.multi();
  multi.setex(`${SESSION_PREFIX}${jti}`, ttl, JSON.stringify(sessionData));
  multi.sadd(`${USER_SESSIONS_PREFIX}${userId}`, jti);
  await multi.exec();
}

export async function getRedisSession(jti: string): Promise<RedisSessionData | null> {
  const redis = getRedisClient();
  const data = await redis.get(`${SESSION_PREFIX}${jti}`);
  return data ? JSON.parse(data) : null;
}

export async function revokeRedisSession(jti: string, userId?: string): Promise<void> {
  const redis = getRedisClient();
  const ttl = getAccessTokenExpiry();

  const multi = redis.multi();
  multi.setex(`${REVOKED_PREFIX}${jti}`, ttl, '1');
  multi.del(`${SESSION_PREFIX}${jti}`);

  if (userId) {
    multi.srem(`${USER_SESSIONS_PREFIX}${userId}`, jti);
  }

  await multi.exec();
}

export async function isRedisSessionRevoked(jti: string): Promise<boolean> {
  const redis = getRedisClient();
  const revoked = await redis.get(`${REVOKED_PREFIX}${jti}`);
  return revoked !== null;
}

export async function getRedisUserSessions(userId: string): Promise<string[]> {
  const redis = getRedisClient();
  return await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
}

export async function revokeAllRedisUserSessions(userId: string): Promise<number> {
  const redis = getRedisClient();
  const jtis = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);

  if (jtis.length === 0) return 0;

  const ttl = getAccessTokenExpiry();
  const multi = redis.multi();

  for (const jti of jtis) {
    multi.setex(`${REVOKED_PREFIX}${jti}`, ttl, '1');
    multi.del(`${SESSION_PREFIX}${jti}`);
  }

  multi.del(`${USER_SESSIONS_PREFIX}${userId}`);
  await multi.exec();

  return jtis.length;
}

export async function saveRedisRefreshToken(
  tokenHash: string,
  data: RedisRefreshTokenData,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedisClient();
  const ttl = ttlSeconds ?? getRefreshTokenExpiry();
  await redis.setex(`${REFRESH_PREFIX}${tokenHash}`, ttl, JSON.stringify(data));
}

export async function getRedisRefreshToken(
  tokenHash: string
): Promise<RedisRefreshTokenData | null> {
  const redis = getRedisClient();
  const data = await redis.get(`${REFRESH_PREFIX}${tokenHash}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteRedisRefreshToken(tokenHash: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${REFRESH_PREFIX}${tokenHash}`);
}

export async function markRefreshTokenFamilyUsed(familyId: string): Promise<void> {
  const redis = getRedisClient();
  const ttl = getRefreshTokenExpiry();
  await redis.setex(`${REFRESH_PREFIX}family:${familyId}`, ttl, '1');
}

export async function isRefreshTokenFamilyUsed(familyId: string): Promise<boolean> {
  const redis = getRedisClient();
  const used = await redis.get(`${REFRESH_PREFIX}family:${familyId}`);
  return used !== null;
}