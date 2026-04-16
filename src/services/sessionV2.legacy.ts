/**
 * Legacy compatibility wrapper for SessionV2
 *
 * DEPRECATED: This file exists for backward compatibility only.
 * New code should use the injected services from the container.
 *
 * @deprecated Use container.get('SsoSessionService') instead
 */

import { getContainer } from '../core/container-config';
import { SsoSessionService } from './session/sso-session.service';
import { AppSessionService } from './session/app-session.service';
import { RefreshTokenService } from './session/refresh-token.service';
import { TokenValidatorService } from './session/token-validator.service';
import { SessionRevokerService } from './session/session-revoker.service';
import { UserRepository } from '../core/repositories/user.repository';

// Re-export error types for compatibility
export { SessionValidationError } from './session/sso-session.service';
export { SessionValidationError as AppSessionValidationError } from './session/app-session.service';

/**
 * Legacy SessionV2Service wrapper
 * Uses container to resolve the actual service implementation
 */
class LegacySessionV2Service {
  private get ssoSessionService(): SsoSessionService {
    return getContainer().get<SsoSessionService>('SsoSessionService');
  }

  private get appSessionService(): AppSessionService {
    return getContainer().get<AppSessionService>('AppSessionService');
  }

  private get refreshTokenService(): RefreshTokenService {
    return getContainer().get<RefreshTokenService>('RefreshTokenService');
  }

  private get tokenValidatorService(): TokenValidatorService {
    return getContainer().get<TokenValidatorService>('TokenValidatorService');
  }

  private get sessionRevokerService(): SessionRevokerService {
    return getContainer().get<SessionRevokerService>('SessionRevokerService');
  }

  // Delegated methods for backward compatibility

  async createSsoSession(
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    appContext?: { appId?: string; tenantId?: string }
  ): Promise<{ accessToken: string; jti: string }> {
    const userRepo = getContainer().get<UserRepository>('UserRepository');
    const user = await userRepo.findUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return this.ssoSessionService.createSession(userId, user, deviceInfo, appContext);
  }

  async createAppSession(
    userId: string,
    deviceInfo?: { ip?: string; userAgent?: string; fingerprint?: string },
    appContext?: { appId?: string; tenantId?: string }
  ): Promise<any> {
    const userRepo = getContainer().get<UserRepository>('UserRepository');
    const user = await userRepo.findUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return this.appSessionService.createSession(userId, user, deviceInfo, appContext);
  }

  validateAccessToken(token: string): any {
    return this.tokenValidatorService.validateToken(token, 'app');
  }

  async isTokenRevoked(jti: string, sessionType: 'sso' | 'app' = 'app'): Promise<boolean> {
    return this.tokenValidatorService.isTokenRevoked(jti, sessionType);
  }

  async rotateRefreshToken(
    refreshTokenPlain: string,
    appContext?: { appId?: string }
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    return this.refreshTokenService.rotateToken(refreshTokenPlain, appContext);
  }

  async revokeSession(jti: string, userId?: string, sessionType: 'sso' | 'app' = 'app'): Promise<void> {
    if (sessionType === 'sso') {
      return this.sessionRevokerService.revokeSsoSession(jti, userId);
    } else {
      return this.sessionRevokerService.revokeAppSession(jti, userId);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.sessionRevokerService.revokeAllUserSessions(userId);
    return result.ssoCount + result.appCount;
  }

  async revokeSsoSession(jti: string, userId?: string): Promise<void> {
    return this.sessionRevokerService.revokeSsoSession(jti, userId);
  }

  async revokeAppSession(jti: string, userId?: string): Promise<void> {
    return this.sessionRevokerService.revokeAppSession(jti, userId);
  }
}

// Export singleton instance for backward compatibility
export const SessionV2 = new LegacySessionV2Service();
