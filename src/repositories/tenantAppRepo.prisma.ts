import type { Prisma } from '@prisma/client';
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

export interface TenantAppRow {
  id: string;
  tenantId: string;
  applicationId: string;
  isEnabled: boolean;
  config: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantAppWithApplication {
  id: string;
  tenantId: string;
  applicationId: string;
  isEnabled: boolean;
  config: Prisma.JsonValue | null;
  createdAt: Date;
  application: {
    id: string;
    appId: string;
    name: string;
    url: string;
    description: string | null;
    iconUrl: string | null;
    isActive: boolean;
  };
}

/**
 * Enable an application for a tenant
 */
export async function enableAppForTenant(data: {
  tenantId: string;
  applicationId: string;
  config?: Prisma.InputJsonValue;
}): Promise<TenantAppRow> {
  const prisma = getPrisma();

  const tenantApp = await prisma.tenantApp.create({
    data: {
      tenantId: data.tenantId,
      applicationId: data.applicationId,
      config: data.config,
    },
  });

  return tenantApp as TenantAppRow;
}

/**
 * Disable an application for a tenant (soft disable)
 */
export async function disableAppForTenant(
  tenantId: string,
  applicationId: string
): Promise<TenantAppRow> {
  const prisma = getPrisma();

  await prisma.tenantApp.updateMany({
    where: {
      tenantId,
      applicationId,
    },
    data: {
      isEnabled: false,
    },
  });

  // Fetch and return the updated record
  const updated = await prisma.tenantApp.findFirst({
    where: {
      tenantId,
      applicationId,
    },
  });

  return updated as TenantAppRow;
}

/**
 * Remove an application from a tenant (hard delete)
 */
export async function removeAppFromTenant(tenantId: string, applicationId: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.tenantApp.deleteMany({
    where: {
      tenantId,
      applicationId,
    },
  });
}

/**
 * Find tenant app by tenant and application
 */
export async function findTenantApp(
  tenantId: string,
  applicationId: string
): Promise<TenantAppRow | null> {
  const prisma = getPrisma();

  const tenantApp = await prisma.tenantApp.findUnique({
    where: {
      tenantId_applicationId: {
        tenantId,
        applicationId,
      },
    },
  });

  return tenantApp as TenantAppRow | null;
}

/**
 * List all apps for a tenant
 */
export async function listTenantApps(
  tenantId: string,
  enabledOnly: boolean = true
): Promise<TenantAppWithApplication[]> {
  const prisma = getPrisma();

  const tenantApps = await prisma.tenantApp.findMany({
    where: {
      tenantId,
      ...(enabledOnly ? { isEnabled: true } : {}),
    },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
          url: true,
          description: true,
          iconUrl: true,
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

  return tenantApps as TenantAppWithApplication[];
}

/**
 * List all tenants that have an application enabled
 */
export async function listTenantsForApp(applicationId: string): Promise<TenantAppRow[]> {
  const prisma = getPrisma();

  const tenantApps = await prisma.tenantApp.findMany({
    where: {
      applicationId,
      isEnabled: true,
    },
  });

  return tenantApps as TenantAppRow[];
}

/**
 * Check if a tenant has an application enabled
 */
export async function tenantHasApp(tenantId: string, applicationId: string): Promise<boolean> {
  const prisma = getPrisma();

  const count = await prisma.tenantApp.count({
    where: {
      tenantId,
      applicationId,
      isEnabled: true,
    },
  });

  return count > 0;
}

/**
 * Update tenant app configuration
 */
export async function updateTenantAppConfig(
  tenantId: string,
  applicationId: string,
  config: Prisma.InputJsonValue
): Promise<TenantAppRow> {
  const prisma = getPrisma();

  await prisma.tenantApp.updateMany({
    where: {
      tenantId,
      applicationId,
    },
    data: {
      config,
    },
  });

  // Fetch and return the updated record
  const updated = await prisma.tenantApp.findFirst({
    where: {
      tenantId,
      applicationId,
    },
  });

  return updated as TenantAppRow;
}
