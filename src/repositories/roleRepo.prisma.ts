import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../services/prisma';

export interface RoleRow {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

export interface PermissionRow {
  id: string;
  roleId: string;
  applicationId: string;
  resource: string;
  action: string;
  createdAt: Date;
}

/**
 * Create a new role
 */
export async function createRole(data: { tenantId: string; name: string }, tx?: Prisma.TransactionClient): Promise<RoleRow> {
  const prisma = tx || getPrismaClient();

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
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

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
  const prisma = getPrismaClient();

  await prisma.role.delete({
    where: { id },
  });
}

/**
 * Create a new permission
 */
export async function createPermission(data: {
  roleId: string;
  applicationId: string;
  resource: string;
  action: string;
}): Promise<PermissionRow> {
  const prisma = getPrismaClient();

  const permission = await prisma.permission.create({
    data: {
      roleId: data.roleId,
      applicationId: data.applicationId,
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
  const prisma = getPrismaClient();

  const permission = await prisma.permission.findUnique({
    where: { id },
  });

  return permission as PermissionRow | null;
}

/**
 * List permissions for a role
 */
export async function listPermissionsByRole(
  roleId: string
): Promise<Array<PermissionRow & { applicationName?: string; appId?: string }>> {
  const prisma = getPrismaClient();

  const permissions = await prisma.permission.findMany({
    where: { roleId },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return permissions.map((p) => ({
    id: p.id,
    roleId: p.roleId,
    applicationId: p.applicationId,
    resource: p.resource,
    action: p.action,
    createdAt: p.createdAt,
    applicationName: p.application.name,
    appId: p.application.appId,
  }));
}

/**
 * Delete a permission
 */
export async function deletePermission(id: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.permission.delete({
    where: { id },
  });
}

/**
 * Delete permission by role, application, resource, and action
 */
export async function deletePermissionByRoleResourceAction(
  roleId: string,
  applicationId: string,
  resource: string,
  action: string
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.permission.deleteMany({
    where: {
      roleId,
      applicationId,
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
  applicationId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const prisma = getPrismaClient();

  const permission = await prisma.permission.findFirst({
    where: {
      roleId,
      applicationId,
      resource,
      action,
    },
  });

  return !!permission;
}

/**
 * Create default roles for a new tenant with permissions
 * Creates: admin, member, viewer roles with appropriate SSO permissions
 */
export async function createDefaultRoles(
  tenantId: string,
  ssoApplicationId: string,
  tx?: Prisma.TransactionClient
): Promise<{
  admin: RoleRow;
  member: RoleRow;
  viewer: RoleRow;
}> {
  const prisma = tx || getPrismaClient();

  // Admin role with all SSO permissions
  const adminRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'admin',
      permissions: {
        create: [
          { applicationId: ssoApplicationId, resource: 'users', action: 'create' },
          { applicationId: ssoApplicationId, resource: 'users', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'users', action: 'update' },
          { applicationId: ssoApplicationId, resource: 'users', action: 'delete' },
          { applicationId: ssoApplicationId, resource: 'applications', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'roles', action: 'create' },
          { applicationId: ssoApplicationId, resource: 'roles', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'roles', action: 'update' },
          { applicationId: ssoApplicationId, resource: 'roles', action: 'delete' },
          { applicationId: ssoApplicationId, resource: 'permissions', action: 'grant_access' },
          { applicationId: ssoApplicationId, resource: 'permissions', action: 'revoke_access' },
          { applicationId: ssoApplicationId, resource: 'tenants', action: 'update' },
          { applicationId: ssoApplicationId, resource: 'tenants', action: 'invite_members' },
        ],
      },
    },
  });

  // Member role with read permissions
  const memberRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'member',
      permissions: {
        create: [
          { applicationId: ssoApplicationId, resource: 'users', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'applications', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'roles', action: 'read' },
        ],
      },
    },
  });

  // Viewer role with limited read-only permissions
  const viewerRole = await prisma.role.create({
    data: {
      tenantId,
      name: 'viewer',
      permissions: {
        create: [
          { applicationId: ssoApplicationId, resource: 'users', action: 'read' },
          { applicationId: ssoApplicationId, resource: 'applications', action: 'read' },
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

export { closePrisma } from '../services/prisma';
