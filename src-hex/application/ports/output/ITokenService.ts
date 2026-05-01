// User import removed — not used in this interface
import { Session } from '../../../domain/entities/Session';

/**
 * TokenPair
 * Access and refresh tokens
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * TokenClaims
 * Decoded token claims
 */
export interface TokenClaims {
  sub: string; // userId
  jti: string; // sessionId/tokenId
  type: 'access' | 'refresh';
  tenantId?: string;
  appId?: string;
  iat: number;
  exp: number;
}

/**
 * ITokenService
 * Port for token generation and validation
 * Implemented in infrastructure layer
 */
export interface ITokenService {
  /**
   * Generate tokens for a session
   */
  generateTokens(session: Session): Promise<TokenPair>;

  /**
   * Validate access token
   */
  validateAccessToken(token: string): Promise<TokenClaims>;

  /**
   * Validate refresh token
   */
  validateRefreshToken(token: string): Promise<TokenClaims>;

  /**
   * Generate temporary 2FA token
   */
  generateTempToken(userId: string): string;

  /**
   * Validate temporary token
   */
  validateTempToken(token: string): string | null;

  /**
   * Revoke token
   */
  revokeToken(tokenId: string): Promise<void>;
}
