import { Email } from '../../../domain/value-objects/Email';

/**
 * IEmailService
 * Port for sending emails
 * Implemented in infrastructure layer
 */
export interface IEmailService {
  /**
   * Send email verification email
   */
  sendVerificationEmail(to: Email, token: string): Promise<void>;

  /**
   * Send password reset email
   */
  sendPasswordResetEmail(to: Email, token: string): Promise<void>;

  /**
   * Send 2FA code email
   */
  send2FAEmail(to: Email, code: string): Promise<void>;

  /**
   * Send welcome email
   */
  sendWelcomeEmail(to: Email, firstName: string): Promise<void>;
}
