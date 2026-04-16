import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../../config';
import { Logger } from '../../utils/logger';
import { RefreshTokenRepository } from '../../core/repositories/refresh-token.repository';
import { RedisSessionService } from './redis-session.service';
import { AppSessionService } from './app-session.service';

interface DeviceInfo {
  ip?: string;
  userAgent?: string;
}

interface AppContext {
  appId?: string;
}

/**
 * RefreshTokenService
 * Handles refresh token rotation and validation
 * Single Responsibility: Only refresh token operations
 */
export class RefreshTokenService {
  private readonly PEPPER: string;

  constructor(
    private refreshRepo: RefreshTokenRepository,
    private redisService: RedisSessionService,
    private appSessionService: AppSessionService
  ) {
    const pepper = process.env.REFRESH_TOKEN_PEPPER;
    if (!pepper) {
      throw new Error('REFRESH_TOKEN_PEPPER environment variable is required');
    }
    this.PEPPER = pepper;
  }

  /**
   * Hash a refresh token using HMAC-SHA256
   */
  private hashToken(token: string): string {
    return crypto.createHmac('sha256', this.PEPPER).update(token).digest('hex');
  }

  /**
   * Save a new refresh token
   */
  async saveToken(
    userId: string,
    jti: string,
    deviceInfo?: DeviceInfo
  ): Promise<{ refreshToken: string; familyId: string }> {
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);
    const familyId = uuidv4();
    const refreshExpirySeconds = Config.get('v2.refresh_token_expiry', 7 * 24 * 60 * 60);

    // Save to PostgreSQL
    await this.refreshRepo.saveRefreshToken({
      userId,
      tokenHash: refreshTokenHash,
      clientId: `app_v2_${jti}`,
      expiresAt: new Date(Date.now() + refreshExpirySeconds * 1000),
      ip: deviceInfo?.ip,
      userAgent: deviceInfo?.userAgent,
    });

    // Save to Redis
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.saveRefreshToken(
          refreshTokenHash,
          {
            userId,
            jti,
            familyId,
            createdAt: Math.floor(Date.now() / 1000),
          },
          refreshExpirySeconds
        );
      }
    } catch (err) {
      Logger.warn('Redis write failed for refresh token, stored in PG only', { error: err });
    }

    return { refreshToken, familyId };
  }

  /**
   * Rotate a refresh token (invalidate old, create new)
   * Implements refresh token rotation for security
   */
  async rotateToken(
    refreshTokenPlain: string,
    appContext?: AppContext
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    jti: string;
  }> {
    const refreshTokenHash = this.hashToken(refreshTokenPlain);

    // Try Redis first (fast path)
    try {
      if (this.redisService.isAvailable()) {
        const tokenData = await this.redisService.getRefreshToken(refreshTokenHash);

        if (tokenData) {
          // Check for token reuse (security violation)
          const familyUsed = await this.redisService.isRefreshTokenFamilyUsed(tokenData.familyId);
          if (familyUsed) {
            // Security breach detected - revoke all sessions
            await this.revokeAllUserTokens(tokenData.userId);
            Logger.warn('Refresh token reuse detected (Redis) - all sessions revoked', {
              userId: tokenData.userId,
            });
            throw new RefreshTokenValidationError(
              'Token reuse detected - all sessions revoked',
              'TOKEN_REUSE_DETECTED'
            );
          }

          // Invalidate old token
          await this.redisService.deleteRefreshToken(refreshTokenHash);
          await this.redisService.markRefreshTokenFamilyUsed(tokenData.familyId);

          // Also revoke in PostgreSQL for consistency
          const pgRow = await this.refreshRepo.findRefreshTokenByHash(refreshTokenHash);
          if (pgRow) {
            await this.refreshRepo.revokeRefreshTokenById(pgRow.id);
          }

          // Create new session
          return await this.appSessionService.createSession(
            tokenData.userId,
            { id: tokenData.userId } as any,
            undefined,
            appContext
          );
        }
      }
    } catch (err) {
      if (err instanceof RefreshTokenValidationError) throw err;
      Logger.warn('Redis read failed during refresh, falling back to PG', { error: err });
    }

    // Fallback to PostgreSQL
    const row = await this.refreshRepo.findRefreshTokenByHash(refreshTokenHash);
    if (!row) {
      throw new RefreshTokenValidationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (row.revoked) {
      // Token was already used - security breach
      if (row.userId) {
        await this.revokeAllUserTokens(row.userId);
        Logger.warn('Refresh token reuse detected (PG) - all sessions revoked', {
          userId: row.userId,
        });
      }
      throw new RefreshTokenValidationError(
        'Token reuse detected - all sessions revoked',
        'TOKEN_REUSE_DETECTED'
      );
    }

    if (new Date(row.expiresAt) < new Date()) {
      throw new RefreshTokenValidationError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }

    // Revoke old token
    await this.refreshRepo.revokeRefreshTokenById(row.id);

    // Create new session
    return await this.appSessionService.createSession(
      row.userId,
      { id: row.userId } as any,
      undefined,
      appContext
    );
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeAllUserSessions(userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    await this.refreshRepo.revokeAllRefreshTokensForUser(userId);

    Logger.info('All refresh tokens revoked for user', { userId });
  }

  /**
   * Validate a refresh token exists and is not expired
   */
  async validateToken(refreshTokenPlain: string): Promise<{
    isValid: boolean;
    userId?: string;
    error?: string;
  }> {
    const refreshTokenHash = this.hashToken(refreshTokenPlain);

    try {
      if (this.redisService.isAvailable()) {
        const tokenData = await this.redisService.getRefreshToken(refreshTokenHash);
        if (tokenData) {
          return { isValid: true, userId: tokenData.userId };
        }
      }
    } catch (_) {
      // Fall through to PG
    }

    const row = await this.refreshRepo.findRefreshTokenByHash(refreshTokenHash);
    if (!row) {
      return { isValid: false, error: 'INVALID_REFRESH_TOKEN' };
    }

    if (row.revoked) {
      return { isValid: false, error: 'TOKEN_REVOKED' };
    }

    if (new Date(row.expiresAt) < new Date()) {
      return { isValid: false, error: 'REFRESH_TOKEN_EXPIRED' };
    }

    return { isValid: true, userId: row.userId };
  }
}

export class RefreshTokenValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'RefreshTokenValidationError';
    this.code = code;
  }
}
