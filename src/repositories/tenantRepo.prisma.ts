import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../services/prisma';
import { createDefaultRoles } from './roleRepo.prisma';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount?: number;
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
export async function createTenant(data: { name: string; slug: string }, tx?: Prisma.TransactionClient): Promise<TenantRow> {
  const prisma = tx || getPrismaClient();

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
    },
  });

  return tenant as TenantRow;
}

/**
 * Create a new tenant with initial setup (roles and admin member)
 * Executes in a transaction
 */
export async function createTenantWithRelations(
  data: { name: string; slug: string },
  adminUserId: string,
  ssoAppId: string
): Promise<TenantRow> {
  const prisma = getPrismaClient();

  return await prisma.$transaction(async (tx) => {
    // Create tenant
    const tenant = await createTenant(data, tx);

    // Create default roles
    await createDefaultRoles(tenant.id, ssoAppId, tx);

    // Add tenant admin
    await addTenantMember(
      {
        tenantId: tenant.id,
        userId: adminUserId,
        role: 'admin',
      },
      tx
    );

    return tenant;
  });
}

/**
 * Find tenant by ID
 */
export async function findTenantById(id: string): Promise<TenantRow | null> {
  const prisma = getPrismaClient();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
  });

  return tenant as TenantRow | null;
}

/**
 * Find tenant by ID with members and roles
 */
export async function findTenantByIdWithRelations(
  id: string
): Promise<(TenantRow & { members: unknown[]; roles: unknown[] }) | null> {
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  return tenant as TenantRow | null;
}

/**
 * Find tenant by name
 */
export async function findTenantByName(name: string): Promise<TenantRow | null> {
  const prisma = getPrismaClient();

  const tenant = await prisma.tenant.findUnique({
    where: { name },
  });

  return tenant as TenantRow | null;
}

/**
 * List all tenants
 */
export async function listTenants(params?: { skip?: number; take?: number }): Promise<TenantRow[]> {
  const prisma = getPrismaClient();
  const { skip = 0, take = 10 } = params || {};

  const tenants = await prisma.tenant.findMany({
    skip,
    take,
    include: {
      members: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.createdAt,
    memberCount: t.members.length,
  })) as TenantRow[];
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
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

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
}, tx?: Prisma.TransactionClient): Promise<TenantMemberRow> {
  const prisma = tx || getPrismaClient();

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
  const prisma = getPrismaClient();

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
export async function listTenantMembers(tenantId: string): Promise<
  (TenantMemberRow & {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      userStatus: string;
    };
  })[]
> {
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: {
      tenant: {
        include: {
          members: {
            select: { id: true },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    createdAt: m.tenant.createdAt,
    memberCount: m.tenant.members.length,
    role: m.role,
  })) as (TenantRow & { role: string })[];
}

/**
 * Update tenant member role
 */
export async function updateTenantMemberRole(
  tenantId: string,
  userId: string,
  role: string
): Promise<TenantMemberRow> {
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

  await prisma.tenantMember.deleteMany({
    where: {
      tenantId,
      userId,
    },
  });
}

export { closePrisma } from '../services/prisma';
