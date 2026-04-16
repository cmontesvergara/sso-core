import { Logger } from '../../utils/logger';
import { SessionRepository } from '../../core/repositories/session.repository';
import { RefreshTokenRepository } from '../../core/repositories/refresh-token.repository';
import { RedisSessionService } from './redis-session.service';

/**
 * SessionRevokerService
 * Handles session and token revocation
 * Single Responsibility: Only revocation operations
 */
export class SessionRevokerService {
  constructor(
    private sessionRepo: SessionRepository,
    private refreshRepo: RefreshTokenRepository,
    private redisService: RedisSessionService
  ) {}

  /**
   * Revoke a single SSO session
   */
  async revokeSsoSession(jti: string, userId?: string): Promise<void> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeSession(jti, userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    await this.sessionRepo.deleteSSOSession(`sso_v2_${jti}`);

    Logger.info('SSO session revoked', { jti });
  }

  /**
   * Revoke a single App session
   */
  async revokeAppSession(jti: string, userId?: string): Promise<void> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeSession(jti, userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    await this.sessionRepo.deleteAppSession(`app_v2_${jti}`);

    Logger.info('App session revoked', { jti });
  }

  /**
   * Revoke all sessions for a user (SSO + App + Refresh tokens)
   */
  async revokeAllUserSessions(userId: string): Promise<{
    ssoCount: number;
    appCount: number;
  }> {
    try {
      if (this.redisService.isAvailable()) {
        await this.redisService.revokeAllUserSessions(userId);
      }
    } catch (_) {
      // Continue to PG even if Redis fails
    }

    // Revoke PostgreSQL sessions
    const ssoCount = await this.sessionRepo.deleteAllSSOSessionsForUser(userId);
    const appCount = await this.sessionRepo.deleteAllAppSessionsForUser(userId);

    // Revoke all refresh tokens
    await this.refreshRepo.revokeAllRefreshTokensForUser(userId);

    Logger.info('All sessions revoked for user', { userId, ssoCount, appCount });

    return { ssoCount, appCount };
  }

  /**
   * Revoke a session by session token (legacy support)
   */
  async revokeSessionByToken(token: string, sessionType: 'sso' | 'app' = 'app'): Promise<void> {
    if (sessionType === 'sso') {
      await this.sessionRepo.deleteSSOSession(token);
    } else {
      await this.sessionRepo.deleteAppSession(token);
    }

    Logger.info('Session revoked by token', { token, sessionType });
  }

  /**
   * Cleanup expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<{
    ssoCount: number;
    appCount: number;
    refreshTokenCount: number;
  }> {
    const ssoCount = await this.sessionRepo.cleanupExpiredSSOSessions();
    const appCount = await this.sessionRepo.cleanupExpiredAppSessions();
    const refreshTokenCount = await this.refreshRepo.cleanupExpiredRefreshTokens();

    Logger.info('Expired sessions cleaned up', { ssoCount, appCount, refreshTokenCount });

    return { ssoCount, appCount, refreshTokenCount };
  }
}
