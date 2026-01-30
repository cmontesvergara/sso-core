import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a single app resource
 */
export async function createAppResource(data: {
  applicationId: string;
  resource: string;
  action: string;
  description?: string;
  category?: string;
}): Promise<{
  id: string;
  applicationId: string;
  resource: string;
  action: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
}> {
  return await prisma.appResource.create({
    data: {
      applicationId: data.applicationId,
      resource: data.resource,
      action: data.action,
      description: data.description,
      category: data.category,
      isActive: true,
    },
  });
}

/**
 * Bulk create app resources (for app registration)
 */
export async function bulkCreateAppResources(
  applicationId: string,
  resources: Array<{
    resource: string;
    action: string;
    description?: string;
    category?: string;
  }>
): Promise<
  Array<{
    id: string;
    applicationId: string;
    resource: string;
    action: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  const operations = resources.map((resource) =>
    prisma.appResource.upsert({
      where: {
        applicationId_resource_action: {
          applicationId,
          resource: resource.resource,
          action: resource.action,
        },
      },
      update: {
        description: resource.description,
        category: resource.category,
        isActive: true,
      },
      create: {
        applicationId,
        resource: resource.resource,
        action: resource.action,
        description: resource.description,
        category: resource.category,
        isActive: true,
      },
    })
  );

  return await prisma.$transaction(operations);
}

/**
 * List all resources for an application
 */
export async function listAppResources(
  applicationId: string,
  isActive?: boolean
): Promise<
  Array<{
    id: string;
    applicationId: string;
    resource: string;
    action: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  return await prisma.appResource.findMany({
    where: {
      applicationId,
      ...(isActive !== undefined && { isActive }),
    },
    orderBy: [{ category: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
  });
}

/**
 * Find a specific app resource
 */
export async function findAppResource(
  applicationId: string,
  resource: string,
  action: string
): Promise<{
  id: string;
  applicationId: string;
  resource: string;
  action: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
} | null> {
  return await prisma.appResource.findUnique({
    where: {
      applicationId_resource_action: {
        applicationId,
        resource,
        action,
      },
    },
  });
}

/**
 * Delete an app resource
 */
export async function deleteAppResource(id: string): Promise<{
  id: string;
  applicationId: string;
  resource: string;
  action: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
}> {
  return await prisma.appResource.delete({
    where: { id },
  });
}

/**
 * Deactivate an app resource (soft delete)
 */
export async function deactivateAppResource(id: string): Promise<{
  id: string;
  applicationId: string;
  resource: string;
  action: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: Date;
}> {
  return await prisma.appResource.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Get all resources available for a tenant
 * Returns resources from all apps enabled in the tenant
 */
export async function listResourcesByTenant(tenantId: string): Promise<
  Array<{
    id: string;
    applicationId: string;
    applicationName: string;
    appId: string;
    resource: string;
    action: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  const result = await prisma.appResource.findMany({
    where: {
      application: {
        isActive: true,
        tenantApps: {
          some: {
            tenantId,
            isEnabled: true,
          },
        },
      },
      isActive: true,
    },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
        },
      },
    },
    orderBy: [
      { application: { name: 'asc' } },
      { category: 'asc' },
      { resource: 'asc' },
      { action: 'asc' },
    ],
  });

  return result.map((resource) => ({
    id: resource.id,
    applicationId: resource.applicationId,
    applicationName: resource.application.name,
    appId: resource.application.appId,
    resource: resource.resource,
    action: resource.action,
    description: resource.description,
    category: resource.category,
    isActive: resource.isActive,
    createdAt: resource.createdAt,
  }));
}

/**
 * Find application by appId
 */
export async function findApplicationByAppId(appId: string): Promise<{
  id: string;
  appId: string;
  name: string;
  description: string | null;
  url: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  return await prisma.application.findUnique({
    where: { appId },
  });
}

/**
 * Check if tenant has an app enabled
 */
export async function findTenantApp(
  tenantId: string,
  applicationId: string
): Promise<{
  id: string;
  tenantId: string;
  applicationId: string;
  isEnabled: boolean;
  createdAt: Date;
} | null> {
  return await prisma.tenantApp.findFirst({
    where: {
      tenantId,
      applicationId,
      isEnabled: true,
    },
  });
}
