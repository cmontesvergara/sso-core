import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import { Logger } from '../utils/logger';
import { getPrismaClient } from './prisma';
import { JWT } from './jwt';
import {
  saveRedisSession,
  revokeRedisSession,
  isRedisSessionRevoked,
  revokeAllRedisUserSessions,
  saveRedisRefreshToken,
  getRedisRefreshToken,
  deleteRedisRefreshToken,
  markRefreshTokenFamilyUsed,
  isRefreshTokenFamilyUsed,
} from '../repositories/redisSessionRepo';
import type { TokenPayload, SessionV2Result, DeviceInfo } from '../core/dtos/auth-v2.dto';

const REFRESH_TOKEN_PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'change-me-pepper';

function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', REFRESH_TOKEN_PEPPER).update(token).digest('hex');
}

function getAccessTokenExpiry(): number {
  return Config.get('v2.access_token_expiry', 900);
}

function getRefreshTokenExpiry(): number {
  return Config.get('v2.refresh_token_expiry', 7 * 24 * 60 * 60);
}

export class SessionV2Error extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionV2Error';
    this.code = code;
  }
}

export class SessionV2Service {
  private static instance: SessionV2Service;

  private constructor() {}

  static getInstance(): SessionV2Service {
    if (!SessionV2Service.instance) {
      SessionV2Service.instance = new SessionV2Service();
    }
    return SessionV2Service.instance;
  }

  async createSession(
    userId: string,
    deviceInfo?: DeviceInfo
  ): Promise<SessionV2Result> {
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantMembers: {
          include: {
            tenant: {
              include: {
                tenantApps: {
                  where: { isEnabled: true },
                  include: { application: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new SessionV2Error('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionV2Error('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const jti = uuidv4();
    const accessTokenExpiry = getAccessTokenExpiry();

    const payload = {
      sub: user.id,
      jti,
      tenants: user.tenantMembers.map((tm: any) => ({
        id: tm.tenant.id,
        role: tm.role,
        apps: tm.tenant.tenantApps.map((ta: any) => ta.application.appId),
      })),
      systemRole: user.systemRole,
      deviceFingerprint: deviceInfo?.fingerprint,
    };

    const accessToken = JWT.generateToken(payload, accessTokenExpiry);

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const familyId = uuidv4();

    await saveRedisSession(
      jti,
      user.id,
      {
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceFingerprint: deviceInfo?.fingerprint,
      },
      accessTokenExpiry
    );

    await saveRedisRefreshToken(
      refreshTokenHash,
      {
        userId: user.id,
        jti,
        familyId,
        createdAt: Math.floor(Date.now() / 1000),
      },
      getRefreshTokenExpiry()
    );

    Logger.info('Session v2 created', { jti, userId: user.id });

    return { accessToken, refreshToken, jti };
  }

  validateAccessToken(token: string): TokenPayload {
    try {
      const decoded = JWT.verifyToken(token) as any;

      if (!decoded || !decoded.sub || !decoded.jti) {
        throw new SessionV2Error('Invalid token structure', 'INVALID_TOKEN');
      }

      if (decoded.iss !== Config.get('jwt.iss', 'sso.bigso.co')) {
        throw new SessionV2Error('Invalid token issuer', 'INVALID_TOKEN');
      }

      return decoded as TokenPayload;
    } catch (error: any) {
      if (error instanceof SessionV2Error) throw error;

      if (error.name === 'TokenExpiredError') {
        throw new SessionV2Error('Token expired', 'TOKEN_EXPIRED');
      }
      throw new SessionV2Error('Invalid token', 'INVALID_TOKEN');
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return await isRedisSessionRevoked(jti);
  }

  async rotateRefreshToken(
    refreshTokenPlain: string
  ): Promise<SessionV2Result> {
    const refreshTokenHash = hashRefreshToken(refreshTokenPlain);
    const tokenData = await getRedisRefreshToken(refreshTokenHash);

    if (!tokenData) {
      throw new SessionV2Error('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const familyUsed = await isRefreshTokenFamilyUsed(tokenData.familyId);
    if (familyUsed) {
      await revokeAllRedisUserSessions(tokenData.userId);
      Logger.warn('Refresh token reuse detected - all sessions revoked', {
        userId: tokenData.userId,
        familyId: tokenData.familyId,
      });
      throw new SessionV2Error('Token reuse detected - all sessions revoked', 'TOKEN_REUSE_DETECTED');
    }

    await deleteRedisRefreshToken(refreshTokenHash);
    await markRefreshTokenFamilyUsed(tokenData.familyId);

    const newTokens = await this.createSession(tokenData.userId, undefined);

    Logger.info('Refresh token rotated', { userId: tokenData.userId });

    return newTokens;
  }

  async revokeSession(jti: string, userId?: string): Promise<void> {
    await revokeRedisSession(jti, userId);
    Logger.info('Session v2 revoked', { jti });
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const count = await revokeAllRedisUserSessions(userId);
    Logger.info('All sessions revoked for user', { userId, count });
    return count;
  }
}

export const SessionV2 = SessionV2Service.getInstance();