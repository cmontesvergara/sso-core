/**
 * ISmsService
 * Port for sending SMS
 * Implemented in infrastructure layer
 */
export interface ISmsService {
  /**
   * Send 2FA code via SMS
   */
  send2FACode(phoneNumber: string, code: string): Promise<void>;

  /**
   * Send password reset code via SMS
   */
  sendPasswordResetCode(phoneNumber: string, code: string): Promise<void>;
}
