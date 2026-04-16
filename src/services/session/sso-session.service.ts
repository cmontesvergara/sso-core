import { v4 as uuidv4 } from 'uuid';
import { Config } from '../../config';
import { Logger } from '../../utils/logger';
import { JWT } from '../jwt';
import { SessionRepository } from '../../core/repositories/session.repository';
import { RedisSessionService } from './redis-session.service';

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
 * SsoSessionService
 * Handles SSO session creation and management
 * Single Responsibility: Only SSO sessions (not App sessions)
 */
export class SsoSessionService {
  private readonly SSO_V2_PREFIX = 'sso_v2_';

  constructor(
    private sessionRepo: SessionRepository,
    private redisService: RedisSessionService
  ) {}

  /**
   * Create a new SSO session
   * Returns access token and session JTI
   */
  async createSession(
    userId: string,
    user: User,
    deviceInfo?: DeviceInfo,
    appContext?: AppContext
  ): Promise<{ accessToken: string; jti: string }> {
    // Validate user exists and is active
    if (!user) {
      throw new SessionValidationError('User not found', 'USER_NOT_FOUND');
    }

    if (user.userStatus !== 'active') {
      throw new SessionValidationError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const jti = uuidv4();
    const ssoTokenExpiry = 15 * 60; // 15 minutes

    // Build JWT payload
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

    // Write to PostgreSQL
    await this.writeSessionToPg(jti, userId, deviceInfo, ssoTokenExpiry);

    // Write to Redis (best effort)
    try {
      if (this.redisService.isAvailable()) {
        await this.writeSessionToRedis(jti, userId, deviceInfo, ssoTokenExpiry);
      }
    } catch (err) {
      Logger.warn('Redis write failed for SSO session, stored in PG only', { jti, error: err });
    }

    Logger.info('SSO Session created', { jti, userId });

    return { accessToken, jti };
  }

  /**
   * Validate an SSO access token
   */
  validateToken(token: string): any {
    try {
      const decoded = JWT.verifyToken(token) as any;

      if (!decoded || !decoded.sub || !decoded.jti) {
        throw new SessionValidationError('Invalid token structure', 'INVALID_TOKEN');
      }

      if (decoded.iss !== Config.get('jwt.iss', 'sso.bigso.co')) {
        throw new SessionValidationError('Invalid token issuer', 'INVALID_TOKEN');
      }

      return decoded;
    } catch (error: any) {
      if (error instanceof SessionValidationError) throw error;
      if (error.name === 'TokenExpiredError') {
        throw new SessionValidationError('Token expired', 'TOKEN_EXPIRED');
      }
      throw new SessionValidationError('Invalid token', 'INVALID_TOKEN');
    }
  }

  /**
   * Check if a session is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    try {
      if (this.redisService.isAvailable()) {
        const revoked = await this.redisService.isSessionRevoked(jti);
        if (revoked) return true;
      }
    } catch (_) {
      // Fall through to PG check
    }

    // Check PostgreSQL
    const session = await this.sessionRepo.findSSOSessionByToken(`${this.SSO_V2_PREFIX}${jti}`);
    if (!session) return true;
    if (new Date(session.expiresAt) < new Date()) return true;

    return false;
  }

  /**
   * Revoke an SSO session
   */
  async revokeSession(jti: string, userId?: string): Promise<void> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeSession(jti, userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    await this.sessionRepo.deleteSSOSession(`${this.SSO_V2_PREFIX}${jti}`);

    Logger.info('SSO Session revoked', { jti });
  }

  /**
   * Revoke all SSO sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeAllUserSessions(userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    const pgCount = await this.sessionRepo.deleteAllSSOSessionsForUser(userId);

    Logger.info('All SSO sessions revoked for user', { userId });

    return pgCount;
  }

  // Private helpers

  private async writeSessionToPg(
    jti: string,
    userId: string,
    deviceInfo?: DeviceInfo,
    ttl?: number
  ): Promise<void> {
    const expiry = ttl ?? 15 * 60;

    await this.sessionRepo.createSSOSession({
      sessionToken: `${this.SSO_V2_PREFIX}${jti}`,
      userId,
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      expiresAt: new Date(Date.now() + expiry * 1000),
    });
  }

  private async writeSessionToRedis(
    jti: string,
    userId: string,
    deviceInfo?: DeviceInfo,
    ttl?: number
  ): Promise<void> {
    const expiry = ttl ?? 15 * 60;

    await this.redisService.saveSession(jti, userId, {
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
      deviceFingerprint: deviceInfo?.fingerprint,
    }, expiry, 'sso');
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
