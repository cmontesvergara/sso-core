import { getPrismaClient } from '../services/prisma';
import { logger } from '../utils/logger';

export interface OTPSecretRow {
  id: string;
  userId: string;
  secret: string;
  verified: boolean;
  backupCodes: string[];
  createdAt: Date;
}

export async function findOTPSecretByUserId(userId: string): Promise<OTPSecretRow | null> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.oTPSecret.findUnique({
      where: { userId },
    });

    return result as OTPSecretRow | null;
  } catch (error) {
    logger.error(`Failed to find OTP secret for user ${userId}:`, error);
    throw error;
  }
}

export async function saveOTPSecret(
  userId: string,
  secret: string,
  backupCodes: string[],
  verified: boolean = false,
): Promise<OTPSecretRow> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.oTPSecret.upsert({
      where: { userId },
      create: {
        userId,
        secret,
        backupCodes,
        verified,
      },
      update: {
        secret,
        backupCodes,
        verified,
      },
    });

    return result as OTPSecretRow;
  } catch (error) {
    logger.error(`Failed to save OTP secret for user ${userId}:`, error);
    throw error;
  }
}

export async function updateOTPSecretVerification(userId: string, verified: boolean): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.oTPSecret.update({
      where: { userId },
      data: { verified },
    });
  } catch (error) {
    logger.error(`Failed to update OTP secret verification for user ${userId}:`, error);
    throw error;
  }
}

export async function updateBackupCodes(userId: string, codes: string[]): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.oTPSecret.update({
      where: { userId },
      data: { backupCodes: codes },
    });
  } catch (error) {
    logger.error(`Failed to update backup codes for user ${userId}:`, error);
    throw error;
  }
}

export async function deleteOTPSecret(userId: string): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.oTPSecret.delete({
      where: { userId },
    });
  } catch (error) {
    logger.error(`Failed to delete OTP secret for user ${userId}:`, error);
    throw error;
  }
}
