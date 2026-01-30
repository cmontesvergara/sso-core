import { getPrismaClient } from '../services/prisma';

/**
 * SSOSession Repository
 * Handles CRUD operations for SSO portal sessions (cookie-based)
 */

interface CreateSSOSessionInput {
  session_token: string;
  user_id: string;
  ip?: string;
  user_agent?: string;
  expires_at: Date;
}

interface SSOSessionWithUser {
  id: string;
  sessionToken: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userStatus: string;
    systemRole: string;
  };
}

/**
 * Create a new SSO session
 */
export async function createSSOSession(data: CreateSSOSessionInput) {
  const prisma = getPrismaClient();

  return await prisma.sSOSession.create({
    data: {
      sessionToken: data.session_token,
      userId: data.user_id,
      ip: data.ip,
      userAgent: data.user_agent,
      expiresAt: data.expires_at,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Find SSO session by session token
 * Includes user information
 */
export async function findSSOSessionByToken(
  sessionToken: string
): Promise<SSOSessionWithUser | null> {
  const prisma = getPrismaClient();

  return await prisma.sSOSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          userStatus: true,
          systemRole: true,
        },
      },
    },
  });
}

/**
 * Update last activity timestamp
 * For session refresh/keep-alive
 */
export async function updateSSOSessionActivity(sessionToken: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.sSOSession.update({
    where: { sessionToken },
    data: {
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Extend session expiration
 * Used when user is active
 */
export async function extendSSOSession(sessionToken: string, newExpiresAt: Date): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.sSOSession.update({
    where: { sessionToken },
    data: {
      expiresAt: newExpiresAt,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Delete SSO session (logout)
 */
export async function deleteSSOSession(sessionToken: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.sSOSession.delete({
    where: { sessionToken },
  });
}

/**
 * Delete all SSO sessions for a user
 * Used for logout from all devices
 */
export async function deleteAllSSOSessionsForUser(userId: string): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.sSOSession.deleteMany({
    where: { userId },
  });

  return result.count;
}

/**
 * Get all active sessions for a user
 * Useful for "Active Sessions" UI
 */
export async function getActiveSSOSessionsForUser(userId: string) {
  const prisma = getPrismaClient();

  return await prisma.sSOSession.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: {
      lastActivityAt: 'desc',
    },
  });
}

/**
 * Cleanup expired SSO sessions
 * Should be run periodically
 */
export async function cleanupExpiredSSOSessions(): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.sSOSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Count active SSO sessions (monitoring)
 */
export async function countActiveSSOSessions(): Promise<number> {
  const prisma = getPrismaClient();

  return await prisma.sSOSession.count({
    where: {
      expiresAt: { gt: new Date() },
    },
  });
}

/**
 * Delete session by ID
 * Useful for "Revoke this session" functionality
 */
export async function deleteSSOSessionById(id: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.sSOSession.delete({
    where: { id },
  });
}
