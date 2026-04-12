import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import {
  deleteRedisRefreshToken,
  getRedisRefreshToken,
  isRedisSessionRevoked,
  isRefreshTokenFamilyUsed,
  markRefreshTokenFamilyUsed,
  revokeAllRedisUserSessions,
  revokeRedisSession,
  saveRedisRefreshToken,
  saveRedisSession,
} from '../repositories/redisSessionRepo';
import {
  findRefreshTokenByHash as findPgRefreshTokenByHash,
  revokeAllRefreshTokensForUser as revokeAllPgRefreshTokensForUser,
  revokeRefreshTokenById as revokePgRefreshTokenById,
  saveRefreshToken as savePgRefreshToken,
} from '../repositories/refreshTokenRepo.prisma';
import {
  createSSOSession as createPgSession,
  deleteAllSSOSessionsForUser as deleteAllPgSessionsForUser,
  deleteSSOSession as deletePgSession,
  findSSOSessionByToken as findPgSessionByToken,
} from '../repositories/ssoSessionRepo.prisma';
import { isRedisAvailable } from '../services/redis';
import { Logger } from '../utils/logger';
import { JWT } from './jwt';
import { getPrismaClient } from './prisma';

const PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'change-me-pepper';
const V2_PREFIX = 'v2_';

function hashToken(token: string): string {
  return crypto.createHmac('sha256', PEPPER).update(token).digest('hex');
}

class SessionV2Error extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionV2Error';
    this.code = code;
  }
}

export { SessionV2Error };

class SessionV2Service {
  private static instance: SessionV2Service;
  private constructor() { }

  static getInstance(): SessionV2Service {
    if (!SessionV2Service.instance) {
      SessionV2Service.instance = new SessionV2Service();
    }
    return SessionV2Service.instance;
  }

  // ---- Write helpers: always PG, best-effort Redis ----

  private async writeSessionToPg(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    accessTokenExpiry?: number
  ): Promise<void> {
    const ttl = accessTokenExpiry ?? Config.get('v2.access_token_expiry', 900);
    await createPgSession({
      session_token: `${V2_PREFIX}${jti}`,
      user_id: userId,
      ip: deviceInfo?.ip,
      user_agent: deviceInfo?.userAgent,
      expires_at: new Date(Date.now() + ttl * 1000),
    });
  }

  private async writeSessionToRedis(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    accessTokenExpiry?: number
  ): Promise<void> {
    const ttl = accessTokenExpiry ?? Config.get('v2.access_token_expiry', 900);
    await saveRedisSession(jti, userId, {
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
    }, ttl);
  }

  private async writeRefreshToPg(
    userId: string,
    jti: string,
    refreshTokenHash: string,
    refreshExpirySeconds: number,
    deviceInfo?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await savePgRefreshToken({
      user_id: userId,
      token_hash: refreshTokenHash,
      client_id: `v2_${jti}`,
      expires_at: new Date(Date.now() + refreshExpirySeconds * 1000),
      ip: deviceInfo?.ip,
      user_agent: deviceInfo?.userAgent,
    });
  }

  private async writeRefreshToRedis(
    refreshTokenHash: string,
    userId: string,
    jti: string,
    familyId: string,
    refreshExpirySeconds: number
  ): Promise<void> {
    await saveRedisRefreshToken(refreshTokenHash, {
      userId,
      jti,
      familyId,
      createdAt: Math.floor(Date.now() / 1000),
    }, refreshExpirySeconds);
  }

  // ---- Core methods ----

  async createSession(
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    appContext?: { appId?: string; tenantId?: string }
  ): Promise<{ accessToken: string; refreshToken: string; jti: string; tenants: Array<{ id: string; name: string; slug: string; role: string }> }> {
    const prisma = getPrismaClient();
    console.log('Creating session for userId:', userId, 'appContext:', appContext);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    const tenantMembers = await prisma.tenantMember.findMany({
      where: {
        userId: userId,
        tenant: {
          tenantApps: {
            some: {
              application: {
                appId: appContext?.appId,
              },
              isEnabled: true,
            },
          },
        },
      },
      include: {
        tenant: true,
      },
    });

    console.log('Tenant members found:', tenantMembers);



    if (!user) {
      throw new SessionV2Error('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionV2Error('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const jti = uuidv4();
    const accessTokenExpiry = Config.get('v2.access_token_expiry', 900);
    const tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      slug: tm.tenant.slug,
      role: tm.role,
    }))
    const payload: Record<string, any> = {
      sub: user.id,
      jti,
      systemRole: user.systemRole,
      deviceFingerprint: deviceInfo?.fingerprint,
    };

    // Include selected tenantId if provided (from exchange v2)
    if (appContext?.tenantId) {
      payload.tenantId = appContext.tenantId;
    }

    if (appContext?.appId) {
      payload.appId = appContext.appId;
      const application = await prisma.application.findUnique({
        where: { appId: appContext.appId },
      });
      if (application && application.scope && application.scope.length > 0) {
        payload.scope = application.scope;
      }
    }

    const accessToken = JWT.generateToken(payload, accessTokenExpiry);

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const familyId = uuidv4();
    const refreshExpirySeconds = Config.get('v2.refresh_token_expiry', 7 * 24 * 60 * 60);

    // Always write to PG (source of truth)
    await this.writeSessionToPg(jti, user.id, deviceInfo, accessTokenExpiry);
    await this.writeRefreshToPg(user.id, jti, refreshTokenHash, refreshExpirySeconds, deviceInfo);

    // Best-effort write to Redis (cache layer)
    try {
      await this.writeSessionToRedis(jti, user.id, deviceInfo, accessTokenExpiry);
      await this.writeRefreshToRedis(refreshTokenHash, user.id, jti, familyId, refreshExpirySeconds);
    } catch (err) {
      Logger.warn('Redis write failed, session stored in PG only', { jti, error: err });
    }

    Logger.info('Session v2 created', { jti, userId: user.id });


    return { accessToken, refreshToken, jti, tenants };
  }

  validateAccessToken(token: string): any {
    try {
      const decoded = JWT.verifyToken(token) as any;

      if (!decoded || !decoded.sub || !decoded.jti) {
        throw new SessionV2Error('Invalid token structure', 'INVALID_TOKEN');
      }

      if (decoded.iss !== Config.get('jwt.iss', 'sso.bigso.co')) {
        throw new SessionV2Error('Invalid token issuer', 'INVALID_TOKEN');
      }

      return decoded;
    } catch (error: any) {
      if (error instanceof SessionV2Error) throw error;
      if (error.name === 'TokenExpiredError') {
        throw new SessionV2Error('Token expired', 'TOKEN_EXPIRED');
      }
      throw new SessionV2Error('Invalid token', 'INVALID_TOKEN');
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    // Check Redis cache first (fast)
    try {
      if (isRedisAvailable()) {
        const revoked = await isRedisSessionRevoked(jti);
        if (revoked) return true;
      }
    } catch (_) {
      // Redis error, fall through to PG
    }

    // Fallback: check PG. If session doesn't exist, it was revoked/expired
    const session = await findPgSessionByToken(`${V2_PREFIX}${jti}`);
    if (!session) return true;
    if (new Date(session.expiresAt) < new Date()) return true;
    return false;
  }

  async rotateRefreshToken(refreshTokenPlain: string, appContext?: { appId?: string }): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const refreshTokenHash = hashToken(refreshTokenPlain);

    // Try Redis first (fast path)
    try {
      if (isRedisAvailable()) {
        const tokenData = await getRedisRefreshToken(refreshTokenHash);

        if (tokenData) {
          const familyUsed = await isRefreshTokenFamilyUsed(tokenData.familyId);
          if (familyUsed) {
            await this.revokeAllUserSessions(tokenData.userId);
            Logger.warn('Refresh token reuse detected (Redis) - all sessions revoked', { userId: tokenData.userId });
            throw new SessionV2Error('Token reuse detected - all sessions revoked', 'TOKEN_REUSE_DETECTED');
          }

          await deleteRedisRefreshToken(refreshTokenHash);
          await markRefreshTokenFamilyUsed(tokenData.familyId);

          // Delete the old PG refresh token too
          const pgRow = await findPgRefreshTokenByHash(refreshTokenHash);
          if (pgRow) {
            await revokePgRefreshTokenById(pgRow.id);
          }

          return await this.createSession(tokenData.userId, undefined, appContext);
        }
        // Token not found in Redis, fall through to PG
      }
    } catch (err) {
      if (err instanceof SessionV2Error) throw err;
      Logger.warn('Redis read failed during refresh, falling back to PG', { error: err });
    }

    // PG path
    const row = await findPgRefreshTokenByHash(refreshTokenHash);
    if (!row) {
      throw new SessionV2Error('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (row.revoked) {
      if (row.userId) {
        await revokeAllPgRefreshTokensForUser(row.userId);
        await deleteAllPgSessionsForUser(row.userId);
        try { await revokeAllRedisUserSessions(row.userId); } catch (_) { }
      }
      throw new SessionV2Error('Token reuse detected - all sessions revoked', 'TOKEN_REUSE_DETECTED');
    }

    if (new Date(row.expiresAt) < new Date()) {
      throw new SessionV2Error('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }

    await revokePgRefreshTokenById(row.id);

    return await this.createSession(row.userId, undefined, appContext);
  }

  async revokeSession(jti: string, userId?: string): Promise<void> {
    // Revoke in both stores
    try {
      if (isRedisAvailable()) {
        await revokeRedisSession(jti, userId);
      }
    } catch (_) { }

    await deletePgSession(`${V2_PREFIX}${jti}`);

    Logger.info('Session v2 revoked', { jti });
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    // Revoke in both stores
    try {
      if (isRedisAvailable()) {
        await revokeAllRedisUserSessions(userId);
      }
    } catch (_) { }

    const pgCount = await deleteAllPgSessionsForUser(userId);
    await revokeAllPgRefreshTokensForUser(userId);

    return pgCount;
  }
}

export const SessionV2 = SessionV2Service.getInstance();