import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Config } from '../../config';
import { Logger } from '../../utils/logger';
import { JWT } from '../jwt';
import { SessionRepository } from '../../core/repositories/session.repository';
import { RedisSessionService } from './redis-session.service';
import { getPrismaClient } from '../prisma';

interface DeviceInfo {
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

interface AppContext {
  appId?: string;
  tenantId?: string;
}

interface User {
  id: string;
  email: string;
  userStatus: string;
  systemRole: string;
}

/**
 * AppSessionService
 * Handles App session creation and management
 * Single Responsibility: Only App sessions (not SSO sessions)
 */
export class AppSessionService {
  private readonly APP_V2_PREFIX = 'app_v2_';

  constructor(
    private sessionRepo: SessionRepository,
    private redisService: RedisSessionService
  ) {}

  /**
   * Create a new App session with access token, refresh token, and user data
   */
  async createSession(
    userId: string,
    user: User,
    deviceInfo?: DeviceInfo,
    appContext?: AppContext
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    jti: string;
    tenants: Array<{ id: string; name: string; slug: string; role: string }>;
    permissions: Array<{ resource: string; action: string }>;
  }> {
    // Validate user exists and is active
    if (!user) {
      throw new SessionValidationError('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionValidationError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const prisma = getPrismaClient();

    // Fetch tenant memberships
    const tenantMembers = await prisma.tenantMember.findMany({
      where: {
        userId,
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
    const accessTokenExpiry = Config.get('v2.access_token_expiry', 900); // 15 minutes

    const tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      slug: tm.tenant.slug,
      role: tm.role,
    }));

    // Build JWT payload
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
      payload.scope = application?.scope || [];
    }

    const accessToken = JWT.generateToken(payload, accessTokenExpiry);

    // Resolve tenant role and permissions
    let roleId: string | undefined;

    if (appContext?.tenantId && tenantMembers.length > 0) {
      const currentTenantMember = tenantMembers.find(
        (tm: any) => tm.tenantId === appContext.tenantId
      );
      if (currentTenantMember) {
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

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Get permissions for the role
    let permissions: Array<{ resource: string; action: string }> = [];
    if (roleId) {
      const rolePermissions = await prisma.permission.findMany({
        where: { roleId },
        select: { resource: true, action: true },
      });
      permissions = rolePermissions.map((p) => ({ resource: p.resource, action: p.action }));
    }

    // Write session to PostgreSQL
    await this.writeSessionToPg(jti, userId, deviceInfo, accessTokenExpiry, appContext, user.systemRole);

    // Write to Redis (best effort)
    try {
      if (this.redisService.isAvailable()) {
        await this.writeSessionToRedis(jti, userId, deviceInfo, accessTokenExpiry, {
          currentTenant: {
            ...tenants.find((t) => t.id === appContext?.tenantId),
            permissions,
          },
          relatedTenants: tenants,
        });

        // Cache permissions
        if (permissions.length > 0) {
          await this.redisService.cachePermissions(jti, permissions, accessTokenExpiry);
        }
      }
    } catch (err) {
      Logger.warn('Redis write failed for App session, stored in PG only', { jti, error: err });
    }

    Logger.info('App Session created', { jti, userId });

    return {
      user,
      accessToken,
      refreshToken,
      jti,
      tenants,
      permissions,
    };
  }

  /**
   * Revoke an App session
   */
  async revokeSession(jti: string, userId?: string): Promise<void> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeSession(jti, userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    await this.sessionRepo.deleteAppSession(`${this.APP_V2_PREFIX}${jti}`);

    Logger.info('App Session revoked', { jti });
  }

  /**
   * Revoke all App sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeAllUserSessions(userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    const pgCount = await this.sessionRepo.deleteAllAppSessionsForUser(userId);

    Logger.info('All App sessions revoked for user', { userId });

    return pgCount;
  }

  // Private helpers

  private async writeSessionToPg(
    jti: string,
    userId: string,
    deviceInfo?: DeviceInfo,
    ttl?: number,
    appContext?: AppContext,
    systemRole?: string
  ): Promise<void> {
    const expiry = ttl ?? Config.get('v2.access_token_expiry', 900);

    await this.sessionRepo.createAppSession({
      sessionToken: `${this.APP_V2_PREFIX}${jti}`,
      appId: appContext?.appId ?? '',
      userId,
      tenantId: appContext?.tenantId ?? '',
      role: systemRole ?? '',
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      expiresAt: new Date(Date.now() + expiry * 1000),
    });
  }

  private async writeSessionToRedis(
    jti: string,
    userId: string,
    deviceInfo?: DeviceInfo,
    ttl?: number,
    sessionData?: any
  ): Promise<void> {
    const expiry = ttl ?? Config.get('v2.access_token_expiry', 900);

    await this.redisService.saveSession(jti, userId, {
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
      ...sessionData,
    }, expiry, 'app');
  }
}

export class SessionValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionValidationError';
    this.code = code;
  }
}
