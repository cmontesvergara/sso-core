import { UserId } from '../value-objects/UserId';

/**
 * OtpSecretStatus
 * Possible states of OTP secret
 */
export type OtpSecretStatus = 'active' | 'inactive';

/**
 * OtpSecret Entity
 * Represents a 2FA TOTP secret for a user
 * Immutable
 */
export class OtpSecret {
  constructor(
    private readonly _id: string,
    private readonly _userId: UserId,
    private readonly _secret: string, // Encrypted TOTP secret
    private readonly _backupCodes: string[], // Hashed backup codes
    private readonly _status: OtpSecretStatus,
    private readonly _createdAt: Date,
    private readonly _lastUsedAt?: Date,
    private readonly _verifiedAt?: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._backupCodes);
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get secret(): string {
    return this._secret;
  }

  get backupCodes(): ReadonlyArray<string> {
    return this._backupCodes;
  }

  get status(): OtpSecretStatus {
    return this._status;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get lastUsedAt(): Date | undefined {
    return this._lastUsedAt ? new Date(this._lastUsedAt) : undefined;
  }

  get verifiedAt(): Date | undefined {
    return this._verifiedAt ? new Date(this._verifiedAt) : undefined;
  }

  /**
   * Check if 2FA is active
   */
  isActive(): boolean {
    return this._status === 'active';
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(code: string): boolean {
    return this._backupCodes.includes(code);
  }

  /**
   * Mark as used
   */
  markAsUsed(): OtpSecret {
    return new OtpSecret(
      this._id,
      this._userId,
      this._secret,
      this._backupCodes,
      this._status,
      this._createdAt,
      new Date(),
      this._verifiedAt
    );
  }

  /**
   * Deactivate 2FA
   */
  deactivate(): OtpSecret {
    return new OtpSecret(
      this._id,
      this._userId,
      this._secret,
      this._backupCodes,
      'inactive',
      this._createdAt,
      this._lastUsedAt,
      this._verifiedAt
    );
  }

  /**
   * Use a backup code (removes it from the list)
   */
  consumeBackupCode(usedCode: string): OtpSecret {
    return new OtpSecret(
      this._id,
      this._userId,
      this._secret,
      this._backupCodes.filter((code) => code !== usedCode),
      this._status,
      this._createdAt,
      new Date(),
      this._verifiedAt
    );
  }
}
