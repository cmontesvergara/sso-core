import { JWT } from '../jwt';
import { Config } from '../../config';
import { SessionRepository } from '../../core/repositories/session.repository';
import { RedisSessionService } from './redis-session.service';
import { Logger } from '../../utils/logger';

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
  private readonly SSO_V2_PREFIX = 'sso_v2_';
  private readonly APP_V2_PREFIX = 'app_v2_';

  constructor(
    private sessionRepo: SessionRepository,
    private redisService: RedisSessionService
  ) {}

  /**
   * Validate and decode a JWT token
   * Checks signature, expiration, issuer, and revocation status
   */
  async validateToken(token: string, sessionType: 'sso' | 'app' = 'app'): Promise<TokenValidationResult> {
    try {
      // Verify JWT signature and expiration
      const decoded = JWT.verifyToken(token) as any;

      if (!decoded || !decoded.sub || !decoded.jti) {
        return {
          isValid: false,
          error: 'INVALID_TOKEN_STRUCTURE',
        };
      }

      // Validate issuer
      const expectedIss = Config.get('jwt.iss', 'sso.bigso.co');
      if (decoded.iss !== expectedIss) {
        return {
          isValid: false,
          error: 'INVALID_TOKEN_ISSUER',
        };
      }

      // Check revocation status
      const isRevoked = await this.isTokenRevoked(decoded.jti, sessionType);
      if (isRevoked) {
        return {
          isValid: false,
          error: 'TOKEN_REVOKED',
        };
      }

      return {
        isValid: true,
        decoded,
        userId: decoded.sub,
        jti: decoded.jti,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          isValid: false,
          error: 'TOKEN_EXPIRED',
        };
      }

      Logger.debug('Token validation failed', { error: error.message });
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
    // Check Redis first (fast path)
    try {
      if (this.redisService.isAvailable()) {
        const revoked = await this.redisService.isSessionRevoked(jti);
        if (revoked) return true;
      }
    } catch (_) {
      // Fall through to PostgreSQL
    }

    // Check PostgreSQL
    const tokenKey = sessionType === 'sso'
      ? `${this.SSO_V2_PREFIX}${jti}`
      : `${this.APP_V2_PREFIX}${jti}`;

    const session = sessionType === 'sso'
      ? await this.sessionRepo.findSSOSessionByToken(tokenKey)
      : await this.sessionRepo.findAppSessionByToken(tokenKey);

    if (!session) return true;
    if (new Date(session.expiresAt) < new Date()) return true;

    return false;
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
