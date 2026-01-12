import { getPrismaClient } from '../services/prisma';
import { logger } from '../utils/logger';

export interface EmailVerificationRow {
  id: string;
  userId: string;
  token: string;
  email: string;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export async function findEmailVerificationByToken(token: string): Promise<EmailVerificationRow | null> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.emailVerification.findUnique({
      where: { token },
    });

    return result as EmailVerificationRow | null;
  } catch (error) {
    logger.error(`Failed to find email verification for token ${token}:`, error);
    throw error;
  }
}

export async function findEmailVerificationByUserId(userId: string): Promise<EmailVerificationRow[]> {
  try {
    const prisma = getPrismaClient();
    const results = await prisma.emailVerification.findMany({
      where: { userId },
    });

    return results as EmailVerificationRow[];
  } catch (error) {
    logger.error(`Failed to find email verifications for user ${userId}:`, error);
    throw error;
  }
}

export async function saveEmailVerification(
  userId: string,
  email: string,
  token: string,
  expiresAt: Date,
): Promise<EmailVerificationRow> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.emailVerification.create({
      data: {
        userId,
        email,
        token,
        expiresAt,
      },
    });

    return result as EmailVerificationRow;
  } catch (error) {
    logger.error(`Failed to save email verification for user ${userId}:`, error);
    throw error;
  }
}

export async function markEmailVerificationAsVerified(token: string): Promise<EmailVerificationRow> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.emailVerification.update({
      where: { token },
      data: { verified: true },
    });

    return result as EmailVerificationRow;
  } catch (error) {
    logger.error(`Failed to mark email verification as verified for token ${token}:`, error);
    throw error;
  }
}

export async function deleteEmailVerification(token: string): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.emailVerification.delete({
      where: { token },
    });
  } catch (error) {
    logger.error(`Failed to delete email verification for token ${token}:`, error);
    throw error;
  }
}

export async function deleteExpiredEmailVerifications(): Promise<number> {
  try {
    const prisma = getPrismaClient();
    const result = await prisma.emailVerification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info(`Deleted ${result.count} expired email verifications`);
    return result.count;
  } catch (error) {
    logger.error('Failed to delete expired email verifications:', error);
    throw error;
  }
}
