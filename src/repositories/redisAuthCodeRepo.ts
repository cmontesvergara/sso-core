import crypto from 'crypto';
import { getRedisClient } from '../services/redis';
import { Logger } from '../utils/logger';
import type { RedisAuthCodeData } from '../core/dtos/auth-v2.dto';

const CODE_PREFIX = 'v2:auth:code:';
const CODE_TTL = 300;

export async function initRedisAuthCodeRepo(): Promise<void> {
  Logger.info('Redis auth code v2 repository initialized');
}

export async function createRedisAuthCode(data: {
  code: string;
  userId: string;
  tenantId: string;
  appId: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}): Promise<void> {
  const redis = getRedisClient();
  const key = `${CODE_PREFIX}${data.code}`;

  const codeData: RedisAuthCodeData = {
    userId: data.userId,
    tenantId: data.tenantId,
    appId: data.appId,
    codeChallenge: data.codeChallenge,
    codeChallengeMethod: data.codeChallengeMethod || 'S256',
    used: false,
    createdAt: Date.now(),
  };

  await redis.setex(key, CODE_TTL, JSON.stringify(codeData));
}

export async function findRedisAuthCode(code: string): Promise<RedisAuthCodeData | null> {
  const redis = getRedisClient();
  const data = await redis.get(`${CODE_PREFIX}${code}`);
  return data ? JSON.parse(data) : null;
}

export async function exchangeRedisAuthCode(
  code: string,
  appId: string,
  codeVerifier: string
): Promise<{ success: boolean; data?: RedisAuthCodeData; error?: string }> {
  const redis = getRedisClient();
  const key = `${CODE_PREFIX}${code}`;

  const multi = redis.multi();
  multi.get(key);
  multi.del(key);
  const results = await multi.exec();

  const dataStr = results?.[0]?.[1] as string | null;

  if (!dataStr) {
    return { success: false, error: 'INVALID_AUTH_CODE' };
  }

  const codeData: RedisAuthCodeData = JSON.parse(dataStr);

  if (codeData.appId !== appId) {
    return { success: false, error: 'APP_MISMATCH' };
  }

  if (codeData.used) {
    return { success: false, error: 'CODE_REUSE_DETECTED', data: codeData };
  }

  if (!verifyPKCE(codeVerifier, codeData.codeChallenge, codeData.codeChallengeMethod)) {
    return { success: false, error: 'INVALID_CODE_VERIFIER' };
  }

  return { success: true, data: codeData };
}

export async function deleteRedisAuthCode(code: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${CODE_PREFIX}${code}`);
}

export function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string = 'S256'
): boolean {
  if (method === 'S256') {
    const computed = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return computed === codeChallenge;
  }
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  return false;
}

export function generateAuthCode(): string {
  return `ac_${crypto.randomBytes(32).toString('base64url')}`;
}

export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}