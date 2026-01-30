import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

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

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface TenantMemberRow {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

/**
 * Create a new tenant
 */
export async function createTenant(data: { name: string; slug: string }): Promise<TenantRow> {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
    },
  });

  return tenant as TenantRow;
}

/**
 * Find tenant by ID
 */
export async function findTenantById(id: string): Promise<TenantRow | null> {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
  });

  return tenant as TenantRow | null;
}

/**
 * Find tenant by ID with members and roles
 */
export async function findTenantByIdWithRelations(id: string) {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      members: true,
      roles: true,
    },
  });

  return tenant;
}

/**
 * Find tenant by slug
 */
export async function findTenantBySlug(slug: string): Promise<TenantRow | null> {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  return tenant as TenantRow | null;
}

/**
 * Find tenant by name
 */
export async function findTenantByName(name: string): Promise<TenantRow | null> {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.findUnique({
    where: { name },
  });

  return tenant as TenantRow | null;
}

/**
 * List all tenants
 */
export async function listTenants(params?: { skip?: number; take?: number }): Promise<TenantRow[]> {
  const prisma = getPrisma();
  const { skip = 0, take = 10 } = params || {};

  const tenants = await prisma.tenant.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });

  return tenants as TenantRow[];
}

/**
 * Update a tenant
 */
export async function updateTenant(
  id: string,
  data: {
    name?: string;
    slug?: string;
  }
): Promise<TenantRow> {
  const prisma = getPrisma();

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
  });

  return tenant as TenantRow;
}

/**
 * Delete a tenant
 */
export async function deleteTenant(id: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.tenant.delete({
    where: { id },
  });
}

/**
 * Add a member to a tenant
 */
export async function addTenantMember(data: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<TenantMemberRow> {
  const prisma = getPrisma();

  const member = await prisma.tenantMember.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      role: data.role,
    },
  });

  return member as TenantMemberRow;
}

/**
 * Find tenant member
 */
export async function findTenantMember(
  tenantId: string,
  userId: string
): Promise<TenantMemberRow | null> {
  const prisma = getPrisma();

  const member = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      userId,
    },
  });

  return member as TenantMemberRow | null;
}

/**
 * List members of a tenant
 */
export async function listTenantMembers(tenantId: string) {
  const prisma = getPrisma();

  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          userStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return members;
}

/**
 * List tenants for a user
 */
export async function listUserTenants(userId: string): Promise<(TenantRow & { role: string })[]> {
  const prisma = getPrisma();

  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: { tenant: true },
  });

  return memberships.map((m: any) => ({ ...m.tenant, role: m.role })) as (TenantRow & {
    role: string;
  })[];
}

/**
 * Update tenant member role
 */
export async function updateTenantMemberRole(
  tenantId: string,
  userId: string,
  role: string
): Promise<TenantMemberRow> {
  const prisma = getPrisma();

  await prisma.tenantMember.updateMany({
    where: {
      tenantId,
      userId,
    },
    data: { role },
  });

  // Fetch and return the updated member
  const updated = await findTenantMember(tenantId, userId);
  return updated!;
}

/**
 * Remove a member from a tenant
 */
export async function removeTenantMember(tenantId: string, userId: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.tenantMember.deleteMany({
    where: {
      tenantId,
      userId,
    },
  });
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
