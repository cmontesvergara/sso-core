import * as crypto from 'crypto';
import { IHashService } from '../../application/ports/output/IHashService';

/**
 * HmacSha256HashService
 * Uses HMAC-SHA256 with REFRESH_TOKEN_PEPPER — identical algorithm to
 * the legacy src/services/session.ts hashToken() function, ensuring
 * tokens stored in the DB are interoperable between legacy and hex modes.
 *
 * REFRESH_TOKEN_PEPPER must be set in .env (see .env.example).
 * Falls back to 'change-me-pepper' in development ONLY.
 */
export class HmacSha256HashService implements IHashService {
  private readonly pepper: string;

  constructor(pepper?: string) {
    this.pepper = pepper ?? process.env.REFRESH_TOKEN_PEPPER ?? 'change-me-pepper';
    if (this.pepper === 'change-me-pepper' && process.env.NODE_ENV === 'production') {
      throw new Error('[HmacSha256HashService] REFRESH_TOKEN_PEPPER is not set in production!');
    }
  }

  /**
   * Returns HMAC-SHA256 hex digest of value using the pepper.
   * Matches legacy: crypto.createHmac('sha256', PEPPER).update(token).digest('hex')
   */
  hash(value: string): string {
    return crypto.createHmac('sha256', this.pepper).update(value).digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing attacks.
   */
  verify(value: string, storedHash: string): boolean {
    const computed = this.hash(value);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch {
      return false;
    }
  }
}
