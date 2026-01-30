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

/**
 * Create default roles for a new tenant with permissions
 * Creates: admin, member, viewer roles with appropriate permissions
 */
export async function createDefaultRoles(tenantId: string): Promise<{
  admin: RoleRow;
  member: RoleRow;
  viewer: RoleRow;
}> {
  const prisma = getPrisma();

  // Admin role with all permissions
  const adminRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'admin',
      permissions: {
        create: [
          { resource: 'users', action: 'create' },
          { resource: 'users', action: 'read' },
          { resource: 'users', action: 'update' },
          { resource: 'users', action: 'delete' },
          { resource: 'applications', action: 'enable' },
          { resource: 'applications', action: 'disable' },
          { resource: 'applications', action: 'grant_access' },
          { resource: 'applications', action: 'revoke_access' },
          { resource: 'roles', action: 'create' },
          { resource: 'roles', action: 'read' },
          { resource: 'roles', action: 'update' },
          { resource: 'roles', action: 'delete' },
          { resource: 'permissions', action: 'assign' },
        ],
      },
    },
  });

  // Member role with read/write permissions
  const memberRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'member',
      permissions: {
        create: [
          { resource: 'users', action: 'read' },
          { resource: 'applications', action: 'read' },
          { resource: 'roles', action: 'read' },
        ],
      },
    },
  });

  // Viewer role with read-only permissions
  const viewerRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'viewer',
      permissions: {
        create: [
          { resource: 'users', action: 'read' },
          { resource: 'applications', action: 'read' },
        ],
      },
    },
  });

  return {
    admin: adminRole as RoleRow,
    member: memberRole as RoleRow,
    viewer: viewerRole as RoleRow,
  };
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
