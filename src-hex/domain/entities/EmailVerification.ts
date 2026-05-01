import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';

/**
 * EmailVerificationStatus
 * Possible states of email verification
 */
export type EmailVerificationStatus = 'pending' | 'verified' | 'expired';

/**
 * EmailVerification Entity
 * Represents the email verification process for a user
 * Immutable
 */
export class EmailVerification {
  constructor(
    private readonly _id: string,
    private readonly _userId: UserId,
    private readonly _email: Email,
    private readonly _token: string, // Verification token (hashed)
    private readonly _createdAt: Date,
    private readonly _expiresAt: Date,
    private readonly _status: EmailVerificationStatus = 'pending',
    private readonly _verifiedAt?: Date
  ) {
    Object.freeze(this);
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get email(): Email {
    return this._email;
  }

  get token(): string {
    return this._token;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get status(): EmailVerificationStatus {
    return this._status;
  }

  get verifiedAt(): Date | undefined {
    return this._verifiedAt ? new Date(this._verifiedAt) : undefined;
  }

  /**
   * Check if token has expired
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Check if token is pending and not expired
   */
  isPending(): boolean {
    return this._status === 'pending' && !this.isExpired();
  }

  /**
   * Verify token matches
   */
  verifyToken(providedToken: string): boolean {
    return this._token === providedToken && this.isPending();
  }

  /**
   * Mark as verified
   */
  markAsVerified(): EmailVerification {
    if (!this.isPending()) {
      throw new Error('Cannot verify: token is not pending');
    }
    return new EmailVerification(
      this._id,
      this._userId,
      this._email,
      this._token,
      this._createdAt,
      this._expiresAt,
      'verified',
      new Date()
    );
  }

  /**
   * Mark as expired
   */
  markAsExpired(): EmailVerification {
    return new EmailVerification(
      this._id,
      this._userId,
      this._email,
      this._token,
      this._createdAt,
      this._expiresAt,
      'expired',
      this._verifiedAt
    );
  }
}
