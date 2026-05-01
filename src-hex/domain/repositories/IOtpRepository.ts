import { OtpSecret } from '../entities/OtpSecret';
import { UserId } from '../value-objects/UserId';

/**
 * IOtpRepository
 * Interface for OTP Secret persistence operations
 * Domain layer - no implementation details
 */
export interface IOtpRepository {
  /**
   * Find OTP secret by ID
   */
  findById(id: string): Promise<OtpSecret | null>;

  /**
   * Find active OTP secret by user
   */
  findActiveByUser(userId: UserId): Promise<OtpSecret | null>;

  /**
   * Save a new OTP secret
   */
  save(secret: OtpSecret): Promise<void>;

  /**
   * Update an existing OTP secret
   */
  update(secret: OtpSecret): Promise<void>;

  /**
   * Delete an OTP secret
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all secrets for a user
   */
  deleteAllForUser(userId: UserId): Promise<number>;

  /**
   * Check if user has 2FA enabled
   */
  isEnabledForUser(userId: UserId): Promise<boolean>;
}
