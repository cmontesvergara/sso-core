import { EmailVerification } from '../entities/EmailVerification';
import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';

/**
 * IEmailVerificationRepository
 * Interface for EmailVerification persistence operations
 * Domain layer - no implementation details
 */
export interface IEmailVerificationRepository {
  /**
   * Find verification by ID
   */
  findById(id: string): Promise<EmailVerification | null>;

  /**
   * Find pending verification by user
   */
  findPendingByUser(userId: UserId): Promise<EmailVerification | null>;

  /**
   * Find verification by token
   */
  findByToken(token: string): Promise<EmailVerification | null>;

  /**
   * Save a new verification
   */
  save(verification: EmailVerification): Promise<void>;

  /**
   * Update an existing verification
   */
  update(verification: EmailVerification): Promise<void>;

  /**
   * Delete a verification
   */
  delete(id: string): Promise<void>;

  /**
   * Delete expired verifications
   */
  deleteExpired(): Promise<number>;

  /**
   * Check if email is verified
   */
  isEmailVerified(email: Email): Promise<boolean>;
}
