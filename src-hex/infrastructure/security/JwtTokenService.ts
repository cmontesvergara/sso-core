import jwt from 'jsonwebtoken';
import {
  ITokenService,
  TokenClaims,
  TokenPair,
} from '../../application/ports/output/ITokenService';
import { AppSession, SSOSession } from '../../domain/entities/Session';

/**
 * JwtTokenService
 * Implementation of ITokenService using JWT
 */
export class JwtTokenService implements ITokenService {
  constructor(
    private privateKey: string,
    private publicKey: string,
    private issuer: string = 'sso.bigso.co'
  ) { }

  async generateTokens(session: SSOSession | AppSession): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 15 * 60; // 15 minutes

    // Audience: always includes the SSO base audience.
    // For AppSession tokens, also spread:
    //   - audience field (comma-separated): "https://api.ordamy.com,https://ordamy.bigso.co"
    //   - url (frontend origin)
    //   - backendUrl (API origin)
    const baseAudience = process.env.JWT_AUD || 'https://sso.bigso.co';
    const appAudiences: string[] =
      session instanceof AppSession
        ? [
            ...(session.audience
              ? session.audience.split(',').map((a) => a.trim()).filter(Boolean)
              : []),
            ...(session.url       ? [session.url]       : []),
            ...(session.backendUrl ? [session.backendUrl] : []),
          ]
        : [];
    const audience: string[] = [baseAudience, ...appAudiences];

    const keyid = process.env.JWT_KID || 'sso-key-2025';

    const accessTokenPayload: Record<string, any> = {
      sub: session.userId.value,
      jti: session.sessionToken,
      type: 'access',
      iat: now,
      exp: now + expiresIn,
      iss: this.issuer,
    };

    if (session instanceof AppSession) {
      accessTokenPayload['https://bigso.co/tenant_id'] = session.tenantId.value;
      accessTokenPayload['https://bigso.co/app_id'] = session.appId;
      accessTokenPayload['https://bigso.co/role'] = (session as any)._role;
    }

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
      audience: audience,
      keyid: keyid,
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.privateKey, {
      algorithm: 'RS256',
      audience: audience,
      keyid: keyid,
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
      issuer: this.issuer,
      audience: process.env.JWT_AUD || 'https://sso.bigso.co',
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
      systemRole: decoded.systemRole,
    };
  }

  async validateRefreshToken(token: string): Promise<TokenClaims> {
    const decoded = jwt.verify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: this.issuer,
      audience: process.env.JWT_AUD || 'https://sso.bigso.co',
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
      systemRole: decoded.systemRole,
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

    const audience = process.env.JWT_AUD || 'https://sso.bigso.co';
    const keyid = process.env.JWT_KID || 'sso-key-2025';

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      audience: audience,
      keyid: keyid,
    });
  }

  validateTempToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: process.env.JWT_AUD || 'https://sso.bigso.co',
      }) as any;

      if (decoded.type !== 'temp') {
        return null;
      }

      return decoded.sub;
    } catch {
      return null;
    }
  }

  generateSignedPayload(payload: Record<string, any>, audience: string): string {
    const keyid = process.env.JWT_KID || 'sso-key-2025';

    // Default expiration for signed payload (5 minutes)
    const expiresIn = 5 * 60;

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn,
      audience,
      keyid,
      issuer: this.issuer
    });
  }

  async revokeToken(tokenId: string): Promise<void> {
    // In a real implementation, this would add to a blacklist
    // For now, just a placeholder
    console.log(`Token ${tokenId} revoked`);
  }
}
