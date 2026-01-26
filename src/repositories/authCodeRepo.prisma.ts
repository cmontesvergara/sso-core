import { getPrismaClient } from '../services/prisma';

/**
 * AuthCode Repository
 * Handles CRUD operations for OAuth2 authorization codes
 */

interface CreateAuthCodeInput {
  code: string;
  user_id: string;
  tenant_id: string;
  app_id: string;
  redirect_uri: string;
  expires_at: Date;
}

interface AuthCodeWithRelations {
  id: string;
  code: string;
  userId: string;
  tenantId: string;
  appId: string;
  redirectUri: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Create a new authorization code
 */
export async function createAuthCode(data: CreateAuthCodeInput) {
  const prisma = getPrismaClient();

  return await prisma.authCode.create({
    data: {
      code: data.code,
      userId: data.user_id,
      tenantId: data.tenant_id,
      appId: data.app_id,
      redirectUri: data.redirect_uri,
      expiresAt: data.expires_at,
      used: false,
    },
  });
}

/**
 * Find authorization code by code string
 * Includes user and tenant relations
 */
export async function findAuthCodeByCode(
  code: string
): Promise<AuthCodeWithRelations | null> {
  const prisma = getPrismaClient();

  return await prisma.authCode.findUnique({
    where: { code },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

/**
 * Mark authorization code as used
 * One-time use enforcement
 */
export async function markAuthCodeAsUsed(code: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.authCode.update({
    where: { code },
    data: { used: true },
  });
}

/**
 * Delete authorization code (after use or expiry)
 */
export async function deleteAuthCode(code: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.authCode.delete({
    where: { code },
  });
}

/**
 * Delete all expired or used authorization codes
 * Should be run periodically as cleanup
 */
export async function cleanupExpiredAuthCodes(): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.authCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true },
      ],
    },
  });

  return result.count;
}

/**
 * Get all active (unused, non-expired) auth codes for a user
 * Useful for debugging/monitoring
 */
export async function getActiveAuthCodesForUser(userId: string) {
  const prisma = getPrismaClient();

  return await prisma.authCode.findMany({
    where: {
      userId,
      used: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Count active auth codes (monitoring)
 */
export async function countActiveAuthCodes(): Promise<number> {
  const prisma = getPrismaClient();

  return await prisma.authCode.count({
    where: {
      used: false,
      expiresAt: { gt: new Date() },
    },
  });
}
