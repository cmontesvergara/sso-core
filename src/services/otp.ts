import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { OTPSetupResponse } from '../core/dtos';
import { logger } from '../utils/logger';
import { getPrismaClient } from './prisma';

export class OTPService {
  private static instance: OTPService;

  private constructor() {}

  static getInstance(): OTPService {
    if (!OTPService.instance) {
      OTPService.instance = new OTPService();
    }
    return OTPService.instance;
  }

  /**
   * Generate OTP secret and QR code for setup
   */
  async generateOTPSecret(userId: string, userName: string): Promise<OTPSetupResponse> {
    try {
      const secret = speakeasy.generateSecret({
        name: `SSO BIGSO | ${userName.toUpperCase()}`,
        issuer: 'BIGSO.CO',
        length: 32,
      });

      // Generate 10 backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()
      );

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

      // Save to database
      const prisma = getPrismaClient();
      await prisma.oTPSecret.upsert({
        where: { userId },
        update: {
          secret: secret.base32,
          verified: false,
          backupCodes,
        },
        create: {
          userId,
          secret: secret.base32,
          backupCodes,
        },
      });

      logger.info(`OTP secret generated for user ${userId}`);

      return {
        secret: secret.base32,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      logger.error(`Failed to generate OTP secret for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Verify OTP token and activate 2FA
   */
  async verifyOTP(userId: string, token: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      const otpSecret = await prisma.oTPSecret.findUnique({
        where: { userId },
      });

      if (!otpSecret) {
        logger.warn(`OTP secret not found for user ${userId}`);
        return false;
      }

      const verified = speakeasy.totp.verify({
        secret: otpSecret.secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time windows (30s each) for clock skew
      });

      if (verified) {
        // Mark as verified
        await prisma.oTPSecret.update({
          where: { userId },
          data: { verified: true },
        });

        logger.info(`OTP verified and activated for user ${userId}`);
      }

      return verified;
    } catch (error) {
      logger.error(`Failed to verify OTP for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate OTP token (for login)
   */
  async validateOTP(userId: string, token: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      const otpSecret = await prisma.oTPSecret.findUnique({
        where: { userId },
      });

      if (!otpSecret || !otpSecret.verified) {
        return false;
      }

      const verified = speakeasy.totp.verify({
        secret: otpSecret.secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      return verified;
    } catch (error) {
      logger.error(`Failed to validate OTP for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Use backup code instead of OTP
   */
  async useBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      const otpSecret = await prisma.oTPSecret.findUnique({
        where: { userId },
      });

      if (!otpSecret || !otpSecret.verified) {
        return false;
      }

      const codeIndex = otpSecret.backupCodes.indexOf(code.toUpperCase());
      if (codeIndex === -1) {
        logger.warn(`Invalid backup code attempted for user ${userId}`);
        return false;
      }

      // Remove used backup code
      const updatedCodes = otpSecret.backupCodes.filter((_: string, i: number) => i !== codeIndex);
      await prisma.oTPSecret.update({
        where: { userId },
        data: { backupCodes: updatedCodes },
      });

      logger.info(`Backup code used for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to use backup code for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disable OTP for user
   */
  async disableOTP(userId: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.oTPSecret.delete({
        where: { userId },
      });

      logger.info(`OTP disabled for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to disable OTP for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has OTP enabled
   */
  async isOTPEnabled(userId: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient();
      const otpSecret = await prisma.oTPSecret.findUnique({
        where: { userId },
      });

      return !!otpSecret?.verified;
    } catch (error) {
      logger.error(`Failed to check OTP status for user ${userId}:`, error);
      throw error;
    }
  }
}

export const OTP = OTPService.getInstance();
