import {
  ITokenService,
  TokenPair,
  TokenClaims,
} from '../../application/ports/output/ITokenService';
import { SSOSession, AppSession } from '../../domain/entities/Session';
import jwt from 'jsonwebtoken';

/**
 * JwtTokenService
 * Implementation of ITokenService using JWT
 */
export class JwtTokenService implements ITokenService {
  constructor(
    private privateKey: string,
    private publicKey: string,
    private issuer: string = 'sso.bigso.co'
  ) {}

  async generateTokens(session: SSOSession | AppSession): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 15 * 60; // 15 minutes

    const accessTokenPayload = {
      sub: session.userId.value,
      jti: session.sessionToken,
      type: 'access',
      iat: now,
      exp: now + expiresIn,
      iss: this.issuer,
    };

    const refreshTokenPayload = {
      sub: session.userId.value,
      jti: `rt_${session.sessionToken}`,
      type: 'refresh',
      iat: now,
      exp: now + 7 * 24 * 60 * 60, // 7 days
      iss: this.issuer,
    };

    const accessToken = jwt.sign(accessTokenPayload, this.privateKey, {
      algorithm: 'RS256',
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.privateKey, {
      algorithm: 'RS256',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  async validateAccessToken(token: string): Promise<TokenClaims> {
    const decoded = jwt.verify(token, this.publicKey, {
      algorithms: ['RS256'],
    }) as any;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return {
      sub: decoded.sub,
      jti: decoded.jti,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }

  async validateRefreshToken(token: string): Promise<TokenClaims> {
    const decoded = jwt.verify(token, this.publicKey, {
      algorithms: ['RS256'],
    }) as any;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return {
      sub: decoded.sub,
      jti: decoded.jti,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }

  generateTempToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      type: 'temp',
      iat: now,
      exp: now + 5 * 60, // 5 minutes
      iss: this.issuer,
    };

    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  validateTempToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as any;

      if (decoded.type !== 'temp') {
        return null;
      }

      return decoded.sub;
    } catch {
      return null;
    }
  }

  async revokeToken(tokenId: string): Promise<void> {
    // In a real implementation, this would add to a blacklist
    // For now, just a placeholder
    console.log(`Token ${tokenId} revoked`);
  }
}
