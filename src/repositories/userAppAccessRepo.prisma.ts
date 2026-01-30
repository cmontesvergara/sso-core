import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

export interface UserAppAccessRow {
  id: string;
  userId: string;
  tenantId: string;
  applicationId: string;
  grantedAt: Date;
  grantedBy: string | null;
}

export interface UserAppAccessWithApplication {
  id: string;
  userId: string;
  tenantId: string;
  applicationId: string;
  grantedAt: Date;
  grantedBy: string | null;
  application: {
    id: string;
    appId: string;
    name: string;
    url: string;
    description: string | null;
    logoUrl: string | null;
    isActive: boolean;
  };
}

/**
 * Grant a user access to an application in a tenant
 */
export async function grantUserAppAccess(data: {
  userId: string;
  tenantId: string;
  applicationId: string;
  grantedBy?: string;
}): Promise<UserAppAccessRow> {
  const prisma = getPrisma();

  const userAppAccess = await prisma.userAppAccess.create({
    data: {
      userId: data.userId,
      tenantId: data.tenantId,
      applicationId: data.applicationId,
      grantedBy: data.grantedBy,
    },
  });

  return userAppAccess as UserAppAccessRow;
}

/**
 * Revoke a user's access to an application in a tenant
 */
export async function revokeUserAppAccess(
  userId: string,
  tenantId: string,
  applicationId: string
): Promise<void> {
  const prisma = getPrisma();

  await prisma.userAppAccess.deleteMany({
    where: {
      userId,
      tenantId,
      applicationId,
    },
  });
}

/**
 * Check if a user has access to an application in a tenant
 */
export async function userHasAppAccess(
  userId: string,
  tenantId: string,
  applicationId: string
): Promise<boolean> {
  const prisma = getPrisma();

  const count = await prisma.userAppAccess.count({
    where: {
      userId,
      tenantId,
      applicationId,
    },
  });

  return count > 0;
}

/**
 * List all applications a user has access to in a specific tenant
 */
export async function listUserAppsInTenant(
  userId: string,
  tenantId: string
): Promise<UserAppAccessWithApplication[]> {
  const prisma = getPrisma();

  const userApps = await prisma.userAppAccess.findMany({
    where: {
      userId,
      tenantId,
    },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
          url: true,
          description: true,
          logoUrl: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      application: {
        name: 'asc',
      },
    },
  });

  return userApps as UserAppAccessWithApplication[];
}

/**
 * List all users who have access to an application in a tenant
 */
export async function listUsersWithAppAccess(
  tenantId: string,
  applicationId: string
): Promise<UserAppAccessRow[]> {
  const prisma = getPrisma();

  const users = await prisma.userAppAccess.findMany({
    where: {
      tenantId,
      applicationId,
    },
  });

  return users as UserAppAccessRow[];
}

/**
 * Grant bulk access (multiple users to one app, or one user to multiple apps)
 */
export async function grantBulkAppAccess(
  grants: Array<{
    userId: string;
    tenantId: string;
    applicationId: string;
    grantedBy?: string;
  }>
): Promise<number> {
  const prisma = getPrisma();

  const result = await prisma.userAppAccess.createMany({
    data: grants,
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Revoke all access for a user in a tenant (when removing user from tenant)
 */
export async function revokeAllUserAccessInTenant(
  userId: string,
  tenantId: string
): Promise<number> {
  const prisma = getPrisma();

  const result = await prisma.userAppAccess.deleteMany({
    where: {
      userId,
      tenantId,
    },
  });

  return result.count;
}

/**
 * Revoke all access to an app in a tenant (when disabling app for tenant)
 */
export async function revokeAllAccessToAppInTenant(
  tenantId: string,
  applicationId: string
): Promise<number> {
  const prisma = getPrisma();

  const result = await prisma.userAppAccess.deleteMany({
    where: {
      tenantId,
      applicationId,
    },
  });

  return result.count;
}

/**
 * Find specific user app access record
 */
export async function findUserAppAccess(
  userId: string,
  tenantId: string,
  applicationId: string
): Promise<UserAppAccessRow | null> {
  const prisma = getPrisma();

  const access = await prisma.userAppAccess.findUnique({
    where: {
      userId_tenantId_applicationId: {
        userId,
        tenantId,
        applicationId,
      },
    },
  });

  return access as UserAppAccessRow | null;
}

/**
 * Get all apps accessible by a user across all tenants
 */
export async function listAllUserApps(userId: string): Promise<UserAppAccessWithApplication[]> {
  const prisma = getPrisma();

  const userApps = await prisma.userAppAccess.findMany({
    where: {
      userId,
    },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
          url: true,
          description: true,
          logoUrl: true,
          isActive: true,
        },
      },
    },
  });

  return userApps as UserAppAccessWithApplication[];
}
