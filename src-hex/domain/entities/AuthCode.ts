import crypto from 'crypto';
import { AuthCodeId } from '../value-objects/Ids';
import { UserId } from '../value-objects/UserId';
import { TenantId } from '../value-objects/TenantId';
import { InvalidAuthCodeError } from '../errors/InvalidAuthCodeError';

/**
 * AuthCode Entity
 * Represents an OAuth authorization code
 * Aligned with Prisma: auth_codes table
 * Immutable
 */
export class AuthCode {
  constructor(
    private readonly _id: AuthCodeId,
    private readonly _code: string,
    private readonly _userId: UserId,
    private readonly _tenantId: TenantId,
    private readonly _appId: string,
    private readonly _redirectUri: string,
    private readonly _expiresAt: Date,
    private readonly _createdAt: Date,
    private readonly _used: boolean = false,
    // Optional PKCE fields
    private readonly _codeChallenge: string | null = null,
    private readonly _codeChallengeMethod: string | null = null,
    private readonly _state: string | null = null,
    private readonly _nonce: string | null = null,
    // Optional reference to SSO session
    private readonly _ssoSessionId: string | null = null
  ) {
    Object.freeze(this);
  }

  // Getters
  get id(): AuthCodeId {
    return this._id;
  }

  get code(): string {
    return this._code;
  }

  get userId(): UserId {
    return this._userId;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get appId(): string {
    return this._appId;
  }

  get redirectUri(): string {
    return this._redirectUri;
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get used(): boolean {
    return this._used;
  }

  get codeChallenge(): string | null {
    return this._codeChallenge;
  }

  get codeChallengeMethod(): string | null {
    return this._codeChallengeMethod;
  }

  get state(): string | null {
    return this._state;
  }

  get nonce(): string | null {
    return this._nonce;
  }

  get ssoSessionId(): string | null {
    return this._ssoSessionId;
  }

  /**
   * Check if code has expired
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Check if code can be used
   */
  isUsable(): boolean {
    return !this._used && !this.isExpired();
  }

  /**
   * Verify PKCE code verifier against stored challenge
   */
  verifyVerifier(verifier: string): boolean {
    if (!this._codeChallenge || !this._codeChallengeMethod) {
      // No PKCE required
      return true;
    }

    if (this._codeChallengeMethod === 'S256') {
      const computed = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
      return computed === this._codeChallenge;
    }

    if (this._codeChallengeMethod === 'plain') {
      return verifier === this._codeChallenge;
    }

    return false;
  }

  /**
   * Mark code as used (exchanged)
   */
  markAsUsed(): AuthCode {
    if (!this.isUsable()) {
      throw new InvalidAuthCodeError('Code is not usable');
    }

    return new AuthCode(
      this._id,
      this._code,
      this._userId,
      this._tenantId,
      this._appId,
      this._redirectUri,
      this._expiresAt,
      this._createdAt,
      true,
      this._codeChallenge,
      this._codeChallengeMethod,
      this._state,
      this._nonce,
      this._ssoSessionId
    );
  }
}
