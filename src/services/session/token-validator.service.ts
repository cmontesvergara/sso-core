import { Config } from '../../config';
import { SessionRepository } from '../../core/repositories/session.repository';
import { Logger } from '../../utils/logger';
import { JWT } from '../jwt';
import { RedisSessionService } from './redis-session.service';

interface TokenValidationResult {
  isValid: boolean;
  decoded?: any;
  error?: string;
  userId?: string;
  jti?: string;
}

/**
 * TokenValidatorService
 * Handles JWT token validation and verification
 * Single Responsibility: Only token validation
 */
export class TokenValidatorService {
  // private readonly SSO_V2_PREFIX = 'sso_v2_';
  private readonly APP_V2_PREFIX = 'app_v2_';

  constructor(
    private sessionRepo: SessionRepository,
    private redisService: RedisSessionService
  ) { }

  /**
   * Validate and decode a JWT token
   * Checks signature, expiration, issuer, and revocation status
   */
  async validateToken(token: string, sessionType: 'sso' | 'app' = 'app'): Promise<TokenValidationResult> {
    Logger.debug('[TokenValidator] Starting token validation', { sessionType, tokenPreview: token.substring(0, 20) + '...' });

    try {
      // Verify JWT signature and expiration
      Logger.debug('[TokenValidator] Verifying JWT signature...');
      const decoded = JWT.verifyToken(token) as any;
      Logger.debug('[TokenValidator] JWT decoded successfully', { jti: decoded?.jti, sub: decoded?.sub, type: decoded?.type });

      if (!decoded || !decoded.sub || !decoded.jti) {
        Logger.debug('[TokenValidator] Invalid token structure', { hasSub: !!decoded?.sub, hasJti: !!decoded?.jti });
        return {
          isValid: false,
          error: 'INVALID_TOKEN_STRUCTURE',
        };
      }

      // Validate issuer
      const expectedIss = Config.get('jwt.iss', 'sso.bigso.co');
      Logger.debug('[TokenValidator] Validating issuer', { expected: expectedIss, actual: decoded.iss });
      if (decoded.iss !== expectedIss) {
        Logger.debug('[TokenValidator] Invalid issuer');
        return {
          isValid: false,
          error: 'INVALID_TOKEN_ISSUER',
        };
      }

      // Check revocation status
      Logger.debug('[TokenValidator] Checking revocation status', { jti: decoded.jti, sessionType });
      const isRevoked = await this.isTokenRevoked(decoded.jti, sessionType);
      Logger.debug('[TokenValidator] Revocation check result', { isRevoked });

      if (isRevoked) {
        return {
          isValid: false,
          error: 'TOKEN_REVOKED',
        };
      }

      Logger.debug('[TokenValidator] Token validation successful');
      return {
        isValid: true,
        decoded,
        userId: decoded.sub,
        jti: decoded.jti,
      };
    } catch (error: any) {
      Logger.error('[TokenValidator] Token validation error', { error: error.message, name: error.name });
      if (error.name === 'TokenExpiredError') {
        return {
          isValid: false,
          error: 'TOKEN_EXPIRED',
        };
      }

      return {
        isValid: false,
        error: 'INVALID_TOKEN',
      };
    }
  }

  /**
   * Check if a token has been revoked
   */
  async isTokenRevoked(jti: string, sessionType: 'sso' | 'app' = 'app'): Promise<boolean> {
    Logger.debug('[TokenValidator.isTokenRevoked] Starting revocation check', { jti, sessionType });

    // Check Redis first (fast path)
    const redisAvailable = this.redisService.isAvailable();
    Logger.debug('[TokenValidator.isTokenRevoked] Redis availability', { redisAvailable });

    if (redisAvailable) {
      try {
        Logger.debug('[TokenValidator.isTokenRevoked] Checking Redis...');
        const exist = await this.redisService.getSession(jti, sessionType);
        const revoked = await this.redisService.isSessionRevoked(jti);
        Logger.debug('[TokenValidator.isTokenRevoked] Redis check result', { revoked });
        if (!exist || (exist && revoked)) {
          Logger.debug('[TokenValidator.isTokenRevoked] Token revoked in Redis');
          return true;
        } else {
          return false;
        }

      } catch (error: any) {
        Logger.warn('[TokenValidator.isTokenRevoked] Redis check failed', { error: error.message });
        // Fall through to PostgreSQL
      }
    } else if (sessionType === 'sso') {
      return true; // Si Redis no está disponible, consideramos los tokens SSO como revocados para evitar riesgos de seguridad
    }

    if (sessionType === 'app') {
      // Check PostgreSQL
      const tokenKey = `${this.APP_V2_PREFIX}${jti}`;
      Logger.debug('[TokenValidator.isTokenRevoked] Checking PostgreSQL', { tokenKey });

      try {
        const session = await this.sessionRepo.findAppSessionByToken(tokenKey);
        Logger.debug('[TokenValidator.isTokenRevoked] PostgreSQL result', { sessionFound: !!session });

        if (!session) {
          Logger.debug('[TokenValidator.isTokenRevoked] Session not found in PostgreSQL');
          return true;
        }
        if (new Date(session.expiresAt) < new Date()) {
          Logger.debug('[TokenValidator.isTokenRevoked] Session expired in PostgreSQL', { expiresAt: session.expiresAt });
          return true;
        }

        Logger.debug('[TokenValidator.isTokenRevoked] Token not revoked');
        return false;
      } catch (error: any) {
        Logger.error('[TokenValidator.isTokenRevoked] PostgreSQL check failed', { error: error.message });
        throw error;
      }
    }
    return true

  }

  /**
   * Decode a token without validation (for debugging)
   */
  decodeToken(token: string): any {
    return JWT.decodeToken(token);
  }

  /**
   * Extract user info from a valid token
   */
  async extractUserInfo(token: string): Promise<{
    userId: string;
    jti: string;
    type: string;
    systemRole?: string;
    tenantId?: string;
    appId?: string;
  } | null> {
    const result = await this.validateToken(token);
    if (!result.isValid || !result.decoded) {
      return null;
    }

    return {
      userId: result.decoded.sub,
      jti: result.decoded.jti,
      type: result.decoded.type,
      systemRole: result.decoded.systemRole,
      tenantId: result.decoded.tenantId,
      appId: result.decoded.appId,
    };
  }
}
