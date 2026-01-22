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

export interface RoleRow {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

export interface PermissionRow {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  createdAt: Date;
}

/**
 * Create a new role
 */
export async function createRole(data: { tenantId: string; name: string }): Promise<RoleRow> {
  const prisma = getPrisma();

  const role = await prisma.role.create({
    data: {
      tenantId: data.tenantId,
      name: data.name,
    },
  });

  return role as RoleRow;
}

/**
 * Find role by ID
 */
export async function findRoleById(id: string): Promise<RoleRow | null> {
  const prisma = getPrisma();

  const role = await prisma.role.findUnique({
    where: { id },
  });

  return role as RoleRow | null;
}

/**
 * Find role by tenant and name
 */
export async function findRoleByTenantAndName(
  tenantId: string,
  name: string
): Promise<RoleRow | null> {
  const prisma = getPrisma();

  const role = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId,
        name,
      },
    },
  });

  return role as RoleRow | null;
}

/**
 * List roles for a tenant
 */
export async function listRolesByTenant(tenantId: string): Promise<RoleRow[]> {
  const prisma = getPrisma();

  const roles = await prisma.role.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return roles as RoleRow[];
}

/**
 * Update a role
 */
export async function updateRole(
  id: string,
  data: {
    name?: string;
  }
): Promise<RoleRow> {
  const prisma = getPrisma();

  const role = await prisma.role.update({
    where: { id },
    data,
  });

  return role as RoleRow;
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.role.delete({
    where: { id },
  });
}

/**
 * Create a new permission
 */
export async function createPermission(data: {
  roleId: string;
  resource: string;
  action: string;
}): Promise<PermissionRow> {
  const prisma = getPrisma();

  const permission = await prisma.permission.create({
    data: {
      roleId: data.roleId,
      resource: data.resource,
      action: data.action,
    },
  });

  return permission as PermissionRow;
}

/**
 * Find permission by ID
 */
export async function findPermissionById(id: string): Promise<PermissionRow | null> {
  const prisma = getPrisma();

  const permission = await prisma.permission.findUnique({
    where: { id },
  });

  return permission as PermissionRow | null;
}

/**
 * List permissions for a role
 */
export async function listPermissionsByRole(roleId: string): Promise<PermissionRow[]> {
  const prisma = getPrisma();

  const permissions = await prisma.permission.findMany({
    where: { roleId },
    orderBy: { createdAt: 'desc' },
  });

  return permissions as PermissionRow[];
}

/**
 * Delete a permission
 */
export async function deletePermission(id: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.permission.delete({
    where: { id },
  });
}

/**
 * Delete permission by role, resource, and action
 */
export async function deletePermissionByRoleResourceAction(
  roleId: string,
  resource: string,
  action: string
): Promise<void> {
  const prisma = getPrisma();

  await prisma.permission.deleteMany({
    where: {
      roleId,
      resource,
      action,
    },
  });
}

/**
 * Check if a permission exists
 */
export async function hasPermission(
  roleId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const prisma = getPrisma();

  const permission = await prisma.permission.findFirst({
    where: {
      roleId,
      resource,
      action,
    },
  });

  return !!permission;
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
