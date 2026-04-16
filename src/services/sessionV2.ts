import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import {
  createAppSession as createAppPgSession,
  deleteAppSession as deleteAppPgSession,
  findAppSessionByToken as findAppPgSessionByToken,
} from '../repositories/appSessionRepo.prisma';
import {
  cachePermissions,
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
import { listPermissionsByRole } from '../repositories/roleRepo.prisma';
import {
  createSSOSession as createPgSession,
  deleteAllSSOSessionsForUser as deleteAllPgSessionsForUser,
  deleteSSOSession as deletePgSession,
  findSSOSessionByToken as findPgSessionByToken,
} from '../repositories/ssoSessionRepo.prisma';
import { UserRow } from '../repositories/userRepo.prisma';
import { isRedisAvailable } from '../services/redis';
import { Logger } from '../utils/logger';
import { JWT } from './jwt';
import { getPrismaClient } from './prisma';
import { validatePepperOrThrow } from '../core/security/pepper-validator';

// Validate PEPPER at startup
validatePepperOrThrow(process.env.REFRESH_TOKEN_PEPPER);

const PEPPER: string = process.env.REFRESH_TOKEN_PEPPER!;
const SSO_V2_PREFIX = 'sso_v2_';
const APP_V2_PREFIX = 'app_v2_';

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

  async createSsoSession(
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    appContext?: { appId?: string; tenantId?: string }
  ): Promise<{ accessToken: string; jti: string }> {
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new SessionV2Error('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionV2Error('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const jti = uuidv4();
    const ssoTokenExpiry = 15 * 60;

    const payload: Record<string, any> = {
      sub: user.id,
      jti,
      type: 'sso',
      systemRole: user.systemRole,
      deviceFingerprint: deviceInfo?.fingerprint,
    };

    if (appContext?.tenantId) {
      payload.tenantId = appContext.tenantId;
    }

    if (appContext?.appId) {
      payload.appId = appContext.appId;
    }

    const accessToken = JWT.generateToken(payload, ssoTokenExpiry);

    await this.writeSsoSessionToPg(jti, user.id, deviceInfo, ssoTokenExpiry);

    try {
      if (isRedisAvailable()) {
        await this.writeSsoSessionToRedis(jti, user.id, deviceInfo, ssoTokenExpiry);
      }
    } catch (err) {
      Logger.warn('Redis write failed for SSO session, stored in PG only', { jti, error: err });
    }

    Logger.info('SSO Session v2 created', { jti, userId: user.id });

    return { accessToken, jti };
  }

  async createAppSession(
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    appContext?: { appId?: string; tenantId?: string },
  ): Promise<{
    user: UserRow;
    accessToken: string; refreshToken: string; jti: string; tenants: Array<{ id: string; name: string; slug: string; role: string }>, permissions: Array<{
      resource: string;
      action: string;
    }>
  }> {

    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });


    if (!user) {
      throw new SessionV2Error('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionV2Error('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

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

    const jti = uuidv4();
    const accessTokenExpiry = Config.get('v2.access_token_expiry', 900);
    const tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      slug: tm.tenant.slug,
      role: tm.role,
    }));

    const payload: Record<string, any> = {
      sub: user.id,
      jti,
      type: 'app',
      systemRole: user.systemRole,
      deviceFingerprint: deviceInfo?.fingerprint,
    };

    if (appContext?.tenantId) {
      payload.tenantId = appContext.tenantId;
    }

    if (appContext?.appId) {
      payload.appId = appContext.appId;
      const application = await prisma.application.findUnique({
        where: { appId: appContext.appId },
      });
      payload.scope = application?.scope || []
    }

    const accessToken = JWT.generateToken(payload, accessTokenExpiry);

    let tenantRole: string | undefined;
    let roleId: string | undefined;

    if (appContext?.tenantId && tenantMembers.length > 0) {
      const currentTenantMember = tenantMembers.find((tm: any) => tm.tenantId === appContext.tenantId);
      if (currentTenantMember) {
        tenantRole = currentTenantMember.role;
        // Buscar el rol en la tabla de roles para obtener su ID
        const roleRecord = await prisma.role.findFirst({
          where: {
            tenantId: appContext.tenantId,
            name: currentTenantMember.role,
          },
        });
        if (roleRecord) {
          roleId = roleRecord.id;
        }
      }
    }
    console.log('Tenant role:', tenantRole, 'Role ID:', roleId);

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const familyId = uuidv4();
    const refreshExpirySeconds = Config.get('v2.refresh_token_expiry', 7 * 24 * 60 * 60);

    // Obtener permisos del rol si existe roleId
    let permissions: Array<{ resource: string; action: string }> = [];
    if (roleId) {
      const rolePermissions = await listPermissionsByRole(roleId);
      permissions = rolePermissions.map((p) => ({ resource: p.resource, action: p.action }));
    }

    await this.writeAppSessionToPg(jti, user.id, deviceInfo, accessTokenExpiry, appContext);
    await this.writeRefreshToPg(user.id, jti, refreshTokenHash, refreshExpirySeconds, deviceInfo);
    const response = {
      user,
      currentTenant: {
        ...tenants.find(t => t.id === appContext?.tenantId),
        permissions
      },
      relatedTenants: tenants,
    }
    try {
      if (isRedisAvailable()) {
        await this.writeAppSessionToRedis(jti, user.id, deviceInfo, accessTokenExpiry, {
          ...appContext,
          ...response
        });
        await this.writeRefreshToRedis(refreshTokenHash, user.id, jti, familyId, refreshExpirySeconds);

        // Cachear permisos por separado para fácil acceso
        if (permissions.length > 0) {
          await cachePermissions(jti, permissions, accessTokenExpiry);
        }
      }
    } catch (err) {
      Logger.warn('Redis write failed for App session, stored in PG only', { jti, error: err });
    }

    Logger.info('App Session v2 created', { jti, userId: user.id });

    return { user, accessToken, refreshToken, jti, tenants, permissions };
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

  async isTokenRevoked(jti: string, sessionType: 'sso' | 'app' = 'app'): Promise<boolean> {
    try {
      if (isRedisAvailable()) {
        const revoked = await isRedisSessionRevoked(jti);
        if (revoked) return true;
      }
    } catch (_) { }

    if (sessionType === 'sso') {
      const session = await findPgSessionByToken(`${SSO_V2_PREFIX}${jti}`);
      if (!session) return true;
      if (new Date(session.expiresAt) < new Date()) return true;
      return false;
    } else {
      const session = await findAppPgSessionByToken(`${APP_V2_PREFIX}${jti}`);
      if (!session) return true;
      if (new Date(session.expiresAt) < new Date()) return true;
      return false;
    }
  }

  async rotateRefreshToken(refreshTokenPlain: string, appContext?: { appId?: string }): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const refreshTokenHash = hashToken(refreshTokenPlain);

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

          const pgRow = await findPgRefreshTokenByHash(refreshTokenHash);
          if (pgRow) {
            await revokePgRefreshTokenById(pgRow.id);
          }

          return await this.createAppSession(tokenData.userId, undefined, appContext);
        }
      }
    } catch (err) {
      if (err instanceof SessionV2Error) throw err;
      Logger.warn('Redis read failed during refresh, falling back to PG', { error: err });
    }

    const row = await findPgRefreshTokenByHash(refreshTokenHash);
    if (!row) {
      throw new SessionV2Error('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (row.revoked) {
      if (row.userId) {
        await revokeAllPgRefreshTokensForUser(row.userId);
        try { await revokeAllRedisUserSessions(row.userId); } catch (_) { }
      }
      throw new SessionV2Error('Token reuse detected - all sessions revoked', 'TOKEN_REUSE_DETECTED');
    }

    if (new Date(row.expiresAt) < new Date()) {
      throw new SessionV2Error('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }

    await revokePgRefreshTokenById(row.id);

    return await this.createAppSession(row.userId, undefined, appContext);
  }

  async revokeSession(jti: string, userId?: string, sessionType: 'sso' | 'app' = 'app'): Promise<void> {
    try {
      if (isRedisAvailable()) {
        await revokeRedisSession(jti, userId);
      }
    } catch (_) { }

    if (sessionType === 'sso') {
      await deletePgSession(`${SSO_V2_PREFIX}${jti}`);
    } else {
      await deleteAppPgSession(`${APP_V2_PREFIX}${jti}`);
    }

    Logger.info('Session v2 revoked', { jti, sessionType });
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      if (isRedisAvailable()) {
        await revokeAllRedisUserSessions(userId);
      }
    } catch (_) { }

    const pgCount = await deleteAllPgSessionsForUser(userId);
    await revokeAllPgRefreshTokensForUser(userId);

    Logger.info('All sessions revoked for user', { userId });

    return pgCount;
  }

  async revokeSsoSession(jti: string, userId?: string): Promise<void> {
    return this.revokeSession(jti, userId, 'sso');
  }

  async revokeAppSession(jti: string, userId?: string): Promise<void> {
    return this.revokeSession(jti, userId, 'app');
  }

  // ---- Private helpers ----

  private async writeSsoSessionToPg(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    ttl?: number
  ): Promise<void> {
    const expiry = ttl ?? 15 * 60;
    await createPgSession({
      session_token: `${SSO_V2_PREFIX}${jti}`,
      user_id: userId,
      ip: deviceInfo?.ip,
      user_agent: deviceInfo?.userAgent,
      expires_at: new Date(Date.now() + expiry * 1000),
    });
  }

  private async writeSsoSessionToRedis(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    ttl?: number
  ): Promise<void> {
    const expiry = ttl ?? 15 * 60;
    await saveRedisSession(jti, userId, {
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
    }, expiry, 'sso');
  }

  private async writeAppSessionToPg(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    ttl?: number,
    appContext?: { appId?: string; tenantId?: string },
    systemRole?: string
  ): Promise<void> {
    const expiry = ttl ?? Config.get('v2.access_token_expiry', 900);
    await createAppPgSession({
      session_token: jti,
      user_id: userId,
      app_id: appContext?.appId ?? '',
      tenant_id: appContext?.tenantId ?? '',
      role: systemRole ?? '',
      ip: deviceInfo?.ip,
      user_agent: deviceInfo?.userAgent,
      expires_at: new Date(Date.now() + expiry * 1000),
    });
  }

  private async writeAppSessionToRedis(
    jti: string,
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    ttl?: number,
    sessionData?: any
  ): Promise<void> {
    const expiry = ttl ?? Config.get('v2.access_token_expiry', 900);
    await saveRedisSession(jti, userId, {
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
      ...sessionData,
    }, expiry, 'app');
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
      client_id: `app_v2_${jti}`,
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
}

export const SessionV2 = SessionV2Service.getInstance();