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

export interface ApplicationRow {
  id: string;
  appId: string;
  name: string;
  url: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new application
 */
export async function createApplication(data: {
  appId: string;
  name: string;
  url: string;
  description?: string;
  logoUrl?: string;
}): Promise<ApplicationRow> {
  const prisma = getPrisma();

  const application = await prisma.application.create({
    data: {
      appId: data.appId,
      name: data.name,
      url: data.url,
      description: data.description,
      logoUrl: data.logoUrl,
    },
  });

  return application as ApplicationRow;
}

/**
 * Find application by ID
 */
export async function findApplicationById(id: string): Promise<ApplicationRow | null> {
  const prisma = getPrisma();

  const application = await prisma.application.findUnique({
    where: { id },
  });

  return application as ApplicationRow | null;
}

/**
 * Find application by appId (e.g., 'crm', 'admin')
 */
export async function findApplicationByAppId(appId: string): Promise<ApplicationRow | null> {
  const prisma = getPrisma();

  const application = await prisma.application.findUnique({
    where: { appId },
  });

  return application as ApplicationRow | null;
}

/**
 * List all applications
 */
export async function listApplications(params?: {
  skip?: number;
  take?: number;
  activeOnly?: boolean;
}): Promise<ApplicationRow[]> {
  const prisma = getPrisma();
  const { skip = 0, take = 50, activeOnly = false } = params || {};

  const applications = await prisma.application.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    skip,
    take,
    orderBy: { name: 'asc' },
  });

  return applications as ApplicationRow[];
}

/**
 * Update application
 */
export async function updateApplication(
  id: string,
  data: {
    name?: string;
    url?: string;
    description?: string;
    iconUrl?: string;
    isActive?: boolean;
  }
): Promise<ApplicationRow> {
  const prisma = getPrisma();

  const application = await prisma.application.update({
    where: { id },
    data,
  });

  return application as ApplicationRow;
}

/**
 * Delete application (soft delete by setting isActive to false)
 */
export async function softDeleteApplication(id: string): Promise<ApplicationRow> {
  const prisma = getPrisma();

  const application = await prisma.application.update({
    where: { id },
    data: { isActive: false },
  });

  return application as ApplicationRow;
}

/**
 * Hard delete application (cascade will delete related records)
 */
export async function deleteApplication(id: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.application.delete({
    where: { id },
  });
}

/**
 * Check if appId exists
 */
export async function appIdExists(appId: string): Promise<boolean> {
  const prisma = getPrisma();

  const count = await prisma.application.count({
    where: { appId },
  });

  return count > 0;
}
