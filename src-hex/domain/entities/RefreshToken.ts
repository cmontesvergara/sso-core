import { RefreshTokenId } from '../value-objects/Ids';
import { UserId } from '../value-objects/UserId';

/**
 * RefreshToken Entity
 * Represents a refresh token for session rotation
 * Aligned with Prisma: refresh_tokens table
 * Immutable
 */
export class RefreshToken {
  constructor(
    private readonly _id: RefreshTokenId,
    private readonly _userId: UserId,
    private readonly _tokenHash: string,
    private readonly _createdAt: Date,
    private readonly _expiresAt: Date,
    private readonly _revoked: boolean = false,
    private readonly _previousTokenId: RefreshTokenId | null = null,
    // Optional fields from Prisma
    private readonly _clientId: string | null = null,
    private readonly _ip: string | null = null,
    private readonly _userAgent: string | null = null
  ) {
    Object.freeze(this);
  }

  // Getters
  get id(): RefreshTokenId {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get tokenHash(): string {
    return this._tokenHash;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get revoked(): boolean {
    return this._revoked;
  }

  get previousTokenId(): RefreshTokenId | null {
    return this._previousTokenId;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  get ip(): string | null {
    return this._ip;
  }

  get userAgent(): string | null {
    return this._userAgent;
  }

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Check if token is active (not expired and not revoked)
   */
  isActive(): boolean {
    return !this.isExpired() && !this._revoked;
  }

  /**
   * Check if token has been rotated (has a previous token reference)
   * Note: In Prisma schema, we track previousTokenId, not replacedBy
   */
  hasBeenRotated(): boolean {
    return !!this._previousTokenId;
  }

  /**
   * Verify token hash matches
   */
  verifyHash(providedHash: string): boolean {
    return this._tokenHash === providedHash;
  }

  /**
   * Revoke this token
   */
  revoke(): RefreshToken {
    if (this._revoked) {
      return this;
    }
    return new RefreshToken(
      this._id,
      this._userId,
      this._tokenHash,
      this._createdAt,
      this._expiresAt,
      true,
      this._previousTokenId,
      this._clientId,
      this._ip,
      this._userAgent
    );
  }

  /**
   * Create a new token that replaces this one (rotation)
   * The new token will have this token's ID as its previousTokenId
   */
  createRotation(newTokenId: RefreshTokenId, newTokenHash: string, expiresAt: Date): RefreshToken {
    return new RefreshToken(
      newTokenId,
      this._userId,
      newTokenHash,
      new Date(),
      expiresAt,
      false,
      this._id, // This token becomes the previous of the new one
      this._clientId,
      this._ip,
      this._userAgent
    );
  }
}

/**
 * TokenFamily
 * Factory for creating token families
 */
export class TokenFamily {
  static generate(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
