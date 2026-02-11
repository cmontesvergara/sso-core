import {
  createPermission,
  createRole,
  deletePermission,
  deletePermissionByRoleResourceAction,
  deleteRole,
  findRoleById,
  findRoleByTenantAndName,
  listPermissionsByRole,
  listRolesByTenant,
  updateRole,
} from '../repositories/roleRepo.prisma';
import { findTenantById, findTenantMember } from '../repositories/tenantRepo.prisma';
import { logger } from '../utils/logger';
import { appResourceService } from './appResource';

export interface CreateRoleInput {
  name: string;
  tenantId: string;
}

export interface UpdateRoleInput {
  name?: string;
}

export interface CreatePermissionInput {
  applicationId: string;
  resource: string;
  action: string;
}

/**
 * Role Service
 * Manages custom roles and permissions within tenants
 */
export class RoleService {
  private static instance: RoleService;

  private constructor() { }

  static getInstance(): RoleService {
    if (!RoleService.instance) {
      RoleService.instance = new RoleService();
    }
    return RoleService.instance;
  }

  /**
   * Create a custom role (tenant admin only)
   */
  async createRole(
    input: CreateRoleInput,
    createdByUserId: string
  ): Promise<{
    id: string;
    tenantId: string;
    name: string;
    createdAt: Date;
  }> {
    try {
      const { name, tenantId } = input;

      // Verify tenant exists
      const tenant = await findTenantById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Verify creator is admin of tenant
      const membership = await findTenantMember(tenantId, createdByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can create roles');
      }

      // Check if role name already exists in tenant
      const existing = await findRoleByTenantAndName(tenantId, name);
      if (existing) {
        throw new Error(`Role "${name}" already exists in this tenant`);
      }

      // Create role
      const role = await createRole({ tenantId, name });

      logger.info(`Role "${name}" created for tenant ${tenantId} by user ${createdByUserId}`);

      return {
        id: role.id,
        tenantId: role.tenantId,
        name: role.name,
        createdAt: role.createdAt,
      };
    } catch (error) {
      logger.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(
    roleId: string,
    userId: string,
    systemRole?: string
  ): Promise<{
    id: string;
    tenantId: string;
    name: string;
    createdAt: Date;
    permissions: Array<{
      id: string;
      resource: string;
      action: string;
      createdAt: Date;
    }>;
  }> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Super Admin and System Admin can access all tenants
      const isSystemAdmin = systemRole === 'super_admin' || systemRole === 'system_admin';

      if (!isSystemAdmin) {
        // Verify user is member of the tenant
        const membership = await findTenantMember(role.tenantId, userId);
        if (!membership) {
          throw new Error('User is not a member of this tenant');
        }
      }

      // Get permissions
      const permissions = await listPermissionsByRole(roleId);

      return {
        id: role.id,
        tenantId: role.tenantId,
        name: role.name,
        createdAt: role.createdAt,
        permissions: permissions.map((p) => ({
          id: p.id,
          resource: p.resource,
          action: p.action,
          applicationId: p.applicationId,
          applicationName: p.applicationName,
          appId: p.appId,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      logger.error(`Failed to get role ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * List all roles for a tenant
   */
  async getTenantRoles(
    tenantId: string,
    userId: string,
    systemRole?: string
  ): Promise<
    Array<{
      id: string;
      tenantId: string;
      name: string;
      createdAt: Date;
    }>
  > {
    try {
      // Super Admin and System Admin can access all tenants
      const isSystemAdmin = systemRole === 'super_admin' || systemRole === 'system_admin';

      if (!isSystemAdmin) {
        // Regular users must be members of the tenant
        const membership = await findTenantMember(tenantId, userId);
        if (!membership) {
          throw new Error('User is not a member of this tenant');
        }
      }

      const roles = await listRolesByTenant(tenantId);

      return roles.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        name: r.name,
        createdAt: r.createdAt,
      }));
    } catch (error) {
      logger.error(`Failed to get roles for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // ... (updateRole, deleteRole, addPermission, removePermission, removePermissionByResourceAction methods remain unchanged for now as they are strictly tenant admin actions)

  /**
   * Update a role (tenant admin only)
   */
  async updateRole(
    roleId: string,
    input: UpdateRoleInput,
    updatedByUserId: string
  ): Promise<{
    id: string;
    tenantId: string;
    name: string;
    createdAt: Date;
  }> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Verify updater is admin of tenant
      const membership = await findTenantMember(role.tenantId, updatedByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can update roles');
      }

      // Prevent updating default roles
      if (['admin', 'member', 'viewer'].includes(role.name)) {
        throw new Error('Cannot update default roles (admin, member, viewer)');
      }

      // If changing name, check it doesn't already exist
      if (input.name && input.name !== role.name) {
        const existing = await findRoleByTenantAndName(role.tenantId, input.name);
        if (existing) {
          throw new Error(`Role "${input.name}" already exists in this tenant`);
        }
      }

      // Update role
      const updated = await updateRole(roleId, input);

      logger.info(`Role ${roleId} updated by user ${updatedByUserId}`);

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        name: updated.name,
        createdAt: updated.createdAt,
      };
    } catch (error) {
      logger.error('Failed to update role:', error);
      throw error;
    }
  }

  /**
   * Delete a role (tenant admin only)
   */
  async deleteRole(roleId: string, deletedByUserId: string): Promise<void> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Verify deleter is admin of tenant
      const membership = await findTenantMember(role.tenantId, deletedByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can delete roles');
      }

      // Prevent deleting default roles
      if (['admin', 'member', 'viewer'].includes(role.name)) {
        throw new Error('Cannot delete default roles (admin, member, viewer)');
      }

      // TODO: Check if role is assigned to any users
      // If so, either prevent deletion or reassign users

      await deleteRole(roleId);

      logger.info(`Role ${roleId} deleted by user ${deletedByUserId}`);
    } catch (error) {
      logger.error('Failed to delete role:', error);
      throw error;
    }
  }

  /**
   * Add permission to a role (tenant admin only)
   */
  async addPermission(
    roleId: string,
    input: CreatePermissionInput,
    addedByUserId: string
  ): Promise<{
    id: string;
    roleId: string;
    resource: string;
    action: string;
    createdAt: Date;
  }> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Verify adder is admin of tenant
      const membership = await findTenantMember(role.tenantId, addedByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can add permissions');
      }

      // Prevent modifying default roles
      if (['admin', 'member', 'viewer'].includes(role.name)) {
        throw new Error('Cannot modify permissions of default roles (admin, member, viewer)');
      }

      // Validate permission exists in app resource catalog
      const validation = await appResourceService.validatePermission(
        input.applicationId,
        input.resource,
        input.action
      );

      if (!validation.valid) {
        throw new Error(validation.message || 'Invalid permission');
      }

      // Validate tenant has access to the application
      const accessValidation = await appResourceService.validateTenantAccess(
        role.tenantId,
        input.applicationId
      );

      if (!accessValidation.valid) {
        throw new Error(
          accessValidation.message || 'Tenant does not have access to this application'
        );
      }

      // Create permission
      const permission = await createPermission({
        roleId,
        applicationId: validation.applicationId!,
        resource: input.resource,
        action: input.action,
      });

      logger.info(
        `Permission ${input.resource}:${input.action} added to role ${roleId} by user ${addedByUserId}`
      );

      return {
        id: permission.id,
        roleId: permission.roleId,
        resource: permission.resource,
        action: permission.action,
        createdAt: permission.createdAt,
      };
    } catch (error) {
      logger.error('Failed to add permission:', error);
      throw error;
    }
  }

  /**
   * Remove permission from a role (tenant admin only)
   */
  async removePermission(
    roleId: string,
    permissionId: string,
    removedByUserId: string
  ): Promise<void> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Verify remover is admin of tenant
      const membership = await findTenantMember(role.tenantId, removedByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can remove permissions');
      }

      // Prevent modifying default roles
      if (['admin', 'member', 'viewer'].includes(role.name)) {
        throw new Error('Cannot modify permissions of default roles (admin, member, viewer)');
      }

      await deletePermission(permissionId);

      logger.info(
        `Permission ${permissionId} removed from role ${roleId} by user ${removedByUserId}`
      );
    } catch (error) {
      logger.error('Failed to remove permission:', error);
      throw error;
    }
  }

  /**
   * Remove permission by resource and action (tenant admin only)
   */
  async removePermissionByResourceAction(
    roleId: string,
    applicationId: string,
    resource: string,
    action: string,
    removedByUserId: string
  ): Promise<void> {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Verify remover is admin of tenant
      const membership = await findTenantMember(role.tenantId, removedByUserId);
      if (!membership || membership.role !== 'admin') {
        throw new Error('Only tenant admins can remove permissions');
      }

      // Prevent modifying default roles
      if (['admin', 'member', 'viewer'].includes(role.name)) {
        throw new Error('Cannot modify permissions of default roles (admin, member, viewer)');
      }

      await deletePermissionByRoleResourceAction(roleId, applicationId, resource, action);

      logger.info(
        `Permission ${resource}:${action} removed from role ${roleId} by user ${removedByUserId}`
      );
    } catch (error) {
      logger.error('Failed to remove permission:', error);
      throw error;
    }
  }

  /**
   * List permissions for a role
   */
  async getRolePermissions(
    roleId: string,
    userId: string,
    systemRole?: string
  ): Promise<
    Array<{
      id: string;
      resource: string;
      action: string;
      createdAt: Date;
    }>
  > {
    try {
      const role = await findRoleById(roleId);

      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }

      // Super Admin and System Admin can access all tenants
      const isSystemAdmin = systemRole === 'super_admin' || systemRole === 'system_admin';

      if (!isSystemAdmin) {
        // Verify user is member of the tenant
        const membership = await findTenantMember(role.tenantId, userId);
        if (!membership) {
          throw new Error('User is not a member of this tenant');
        }
      }

      const permissions = await listPermissionsByRole(roleId);

      return permissions.map((p) => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        applicationId: p.applicationId,
        applicationName: p.applicationName,
        appId: p.appId,
        createdAt: p.createdAt,
      }));
    } catch (error) {
      logger.error(`Failed to get permissions for role ${roleId}:`, error);
      throw error;
    }
  }
}

export const RoleService_Instance = RoleService.getInstance();
