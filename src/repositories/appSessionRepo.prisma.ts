import { getPrismaClient } from '../services/prisma';

/**
 * AppSession Repository
 * Handles CRUD operations for app-specific sessions (per-app cookies)
 * Used by app backends to manage their own sessions
 */

interface CreateAppSessionInput {
  session_token: string;
  app_id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  ip?: string;
  user_agent?: string;
  expires_at: Date;
}

interface AppSessionWithRelations {
  id: string;
  sessionToken: string;
  appId: string;
  userId: string;
  tenantId: string;
  role: string;
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
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Create a new app session
 */
export async function createAppSession(data: CreateAppSessionInput) {
  const prisma = getPrismaClient();

  return await prisma.appSession.create({
    data: {
      sessionToken: data.session_token,
      appId: data.app_id,
      userId: data.user_id,
      tenantId: data.tenant_id,
      role: data.role,
      ip: data.ip,
      userAgent: data.user_agent,
      expiresAt: data.expires_at,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Find app session by session token
 * Includes user and tenant information
 */
export async function findAppSessionByToken(
  sessionToken: string
): Promise<AppSessionWithRelations | null> {
  const prisma = getPrismaClient();

  return await prisma.appSession.findUnique({
    where: { sessionToken },
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
 * Find app session by app_id and user_id
 * Useful for checking existing sessions before creating new ones
 */
export async function findAppSessionByAppAndUser(
  appId: string,
  userId: string,
  tenantId: string
): Promise<AppSessionWithRelations | null> {
  const prisma = getPrismaClient();

  return await prisma.appSession.findFirst({
    where: {
      appId,
      userId,
      tenantId,
      expiresAt: { gt: new Date() },
    },
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
    orderBy: {
      lastActivityAt: 'desc',
    },
  });
}

/**
 * Update last activity timestamp
 */
export async function updateAppSessionActivity(sessionToken: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.appSession.update({
    where: { sessionToken },
    data: {
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Extend app session expiration
 */
export async function extendAppSession(
  sessionToken: string,
  newExpiresAt: Date
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.appSession.update({
    where: { sessionToken },
    data: {
      expiresAt: newExpiresAt,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Delete app session (logout from specific app)
 */
export async function deleteAppSession(sessionToken: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.appSession.delete({
    where: { sessionToken },
  });
}

/**
 * Delete all sessions for a specific app and user
 * Used when user logs out from specific app
 */
export async function deleteAllAppSessionsForUserInApp(
  appId: string,
  userId: string
): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.appSession.deleteMany({
    where: {
      appId,
      userId,
    },
  });

  return result.count;
}

/**
 * Delete all app sessions for a user (across all apps)
 * Used for global logout
 */
export async function deleteAllAppSessionsForUser(userId: string): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.appSession.deleteMany({
    where: { userId },
  });

  return result.count;
}

/**
 * Get all active sessions for a user in a specific app
 */
export async function getActiveAppSessionsForUser(
  appId: string,
  userId: string
) {
  const prisma = getPrismaClient();

  return await prisma.appSession.findMany({
    where: {
      appId,
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: {
      lastActivityAt: 'desc',
    },
  });
}

/**
 * Get all sessions across all apps for a user
 * Useful for "All Devices" view in SSO portal
 */
export async function getAllAppSessionsForUser(userId: string) {
  const prisma = getPrismaClient();

  return await prisma.appSession.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    include: {
      tenant: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      lastActivityAt: 'desc',
    },
  });
}

/**
 * Cleanup expired app sessions
 */
export async function cleanupExpiredAppSessions(): Promise<number> {
  const prisma = getPrismaClient();

  const result = await prisma.appSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Count active app sessions per app (monitoring)
 */
export async function countActiveAppSessionsByApp(appId: string): Promise<number> {
  const prisma = getPrismaClient();

  return await prisma.appSession.count({
    where: {
      appId,
      expiresAt: { gt: new Date() },
    },
  });
}

/**
 * Count all active app sessions (monitoring)
 */
export async function countAllActiveAppSessions(): Promise<number> {
  const prisma = getPrismaClient();

  return await prisma.appSession.count({
    where: {
      expiresAt: { gt: new Date() },
    },
  });
}
