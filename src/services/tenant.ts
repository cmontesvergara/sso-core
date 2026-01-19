import { logger } from '../utils/logger';
import { getPrismaClient } from './prisma';

export interface CreateTenantInput {
  name: string;
  slug?: string;
}

export interface InviteTenantMemberInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

/**
 * Tenant Service
 * Manages multi-tenant operations: creation, membership, roles, permissions
 */
export class TenantService {
  private static instance: TenantService;

  private constructor() {}

  static getInstance(): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService();
    }
    return TenantService.instance;
  }

  /**
   * Create a new tenant
   */
  async createTenant(input: CreateTenantInput, createdByUserId: string) {
    try {
      const prisma = getPrismaClient();

      // Generate slug if not provided
      const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-');

      // Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: input.name,
          slug,
        },
      });

      logger.info(`Tenant created: ${tenant.name} (${tenant.id})`);

      // Create default roles for tenant
      const roles = await this.createDefaultRoles(tenant.id);

      logger.info(`Default roles created for tenant ${tenant.id}: admin, member, viewer`);

      // Add creator as admin
      const adminRole = roles.find(r => r.name === 'admin');
      if (!adminRole) {
        throw new Error('Admin role not created');
      }

      await prisma.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: createdByUserId,
          role: 'admin',
        },
      });

      logger.info(`User ${createdByUserId} added as admin to tenant ${tenant.id}`);

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
      };
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string) {
    try {
      const prisma = getPrismaClient();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          members: true,
          roles: true,
        },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      return tenant;
    } catch (error) {
      logger.error(`Failed to get tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get all tenants for a user
   */
  async getUserTenants(userId: string) {
    try {
      const prisma = getPrismaClient();

      const tenants = await prisma.tenant.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      });

      return tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.members[0]?.role,
        createdAt: t.createdAt,
      }));
    } catch (error) {
      logger.error(`Failed to get tenants for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Invite user to tenant
   */
  async inviteTenantMember(
    tenantId: string,
    invitedByUserId: string,
    input: InviteTenantMemberInput
  ) {
    try {
      const prisma = getPrismaClient();

      // Verify inviter is admin
      const inviterMembership = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: invitedByUserId },
        },
      });

      if (!inviterMembership || inviterMembership.role !== 'admin') {
        throw new Error('Only admins can invite members');
      }

      // Get or create user with email
      let user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: input.email,
            passwordHash: '', // User must signup to set password
            firstName: '',
          },
        });
        logger.info(`New user created: ${input.email}`);
      }

      // Check if already member
      const existing = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: user.id },
        },
      });

      if (existing) {
        throw new Error(`User ${input.email} is already a member of this tenant`);
      }

      // Add to tenant
      await prisma.tenantMember.create({
        data: {
          tenantId,
          userId: user.id,
          role: input.role,
        },
      });

      logger.info(`User ${input.email} invited to tenant ${tenantId} as ${input.role}`);

      return {
        userId: user.id,
        email: user.email,
        role: input.role,
        tenantId,
      };
    } catch (error) {
      logger.error('Failed to invite tenant member:', error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    tenantId: string,
    updatedByUserId: string,
    targetUserId: string,
    newRole: 'admin' | 'member' | 'viewer'
  ) {
    try {
      const prisma = getPrismaClient();

      // Verify updater is admin
      const updaterMembership = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: updatedByUserId },
        },
      });

      if (!updaterMembership || updaterMembership.role !== 'admin') {
        throw new Error('Only admins can update member roles');
      }

      // Verify target is member of tenant
      const member = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: targetUserId },
        },
      });

      if (!member) {
        throw new Error('User is not a member of this tenant');
      }

      // Prevent removing last admin
      if (member.role === 'admin' && newRole !== 'admin') {
        const adminCount = await prisma.tenantMember.count({
          where: { tenantId, role: 'admin' },
        });

        if (adminCount === 1) {
          throw new Error('Cannot remove the last admin from tenant');
        }
      }

      // Update role
      await prisma.tenantMember.update({
        where: {
          tenantId_userId: { tenantId, userId: targetUserId },
        },
        data: { role: newRole },
      });

      logger.info(`Member ${targetUserId} role updated to ${newRole} in tenant ${tenantId}`);

      return { userId: targetUserId, tenantId, role: newRole };
    } catch (error) {
      logger.error('Failed to update member role:', error);
      throw error;
    }
  }

  /**
   * Remove member from tenant
   */
  async removeMember(
    tenantId: string,
    removedByUserId: string,
    targetUserId: string
  ) {
    try {
      const prisma = getPrismaClient();

      // Verify remover is admin
      const removerMembership = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: removedByUserId },
        },
      });

      if (!removerMembership || removerMembership.role !== 'admin') {
        throw new Error('Only admins can remove members');
      }

      // Get member to remove
      const member = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: targetUserId },
        },
      });

      if (!member) {
        throw new Error('User is not a member of this tenant');
      }

      // Prevent removing last admin
      if (member.role === 'admin') {
        const adminCount = await prisma.tenantMember.count({
          where: { tenantId, role: 'admin' },
        });

        if (adminCount === 1) {
          throw new Error('Cannot remove the last admin from tenant');
        }
      }

      // Remove
      await prisma.tenantMember.delete({
        where: {
          tenantId_userId: { tenantId, userId: targetUserId },
        },
      });

      logger.info(`User ${targetUserId} removed from tenant ${tenantId}`);

      return { success: true };
    } catch (error) {
      logger.error('Failed to remove tenant member:', error);
      throw error;
    }
  }

  /**
   * Get tenant members
   */
  async getTenantMembers(tenantId: string) {
    try {
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return members.map(m => ({
        userId: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        role: m.role,
        joinedAt: m.createdAt,
      }));
    } catch (error) {
      logger.error(`Failed to get tenant members for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create default roles for tenant
   */
  private async createDefaultRoles(tenantId: string) {
    try {
      const prisma = getPrismaClient();

      // Define default roles and permissions
      const rolesConfig = {
        admin: [
          { resource: 'users', action: 'read' },
          { resource: 'users', action: 'write' },
          { resource: 'users', action: 'delete' },
          { resource: 'billing', action: 'read' },
          { resource: 'billing', action: 'write' },
          { resource: 'settings', action: 'read' },
          { resource: 'settings', action: 'write' },
        ],
        member: [
          { resource: 'users', action: 'read' },
          { resource: 'profile', action: 'read' },
          { resource: 'profile', action: 'write' },
          { resource: 'billing', action: 'read' },
        ],
        viewer: [
          { resource: 'users', action: 'read' },
          { resource: 'billing', action: 'read' },
        ],
      };

      const roles = [];

      for (const [roleName, permissions] of Object.entries(rolesConfig)) {
        const role = await prisma.role.create({
          data: {
            tenantId,
            name: roleName,
            permissions: {
              createMany: {
                data: permissions,
              },
            },
          },
          include: { permissions: true },
        });

        roles.push(role);
      }

      return roles;
    } catch (error) {
      logger.error('Failed to create default roles:', error);
      throw error;
    }
  }

  /**
   * Get tenant roles with permissions
   */
  async getTenantRoles(tenantId: string) {
    try {
      const prisma = getPrismaClient();

      const roles = await prisma.role.findMany({
        where: { tenantId },
        include: { permissions: true },
        orderBy: { name: 'asc' },
      });

      return roles.map(r => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions.map(p => `${p.resource}:${p.action}`),
      }));
    } catch (error) {
      logger.error(`Failed to get tenant roles for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has permission in tenant
   */
  async hasPermission(
    tenantId: string,
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient();

      // Get user's role in tenant
      const membership = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });

      if (!membership) {
        return false;
      }

      // Check if role has permission
      const permission = await prisma.permission.findFirst({
        where: {
          resource,
          action,
          role: {
            tenantId,
            name: membership.role,
          },
        },
      });

      return !!permission;
    } catch (error) {
      logger.error(`Failed to check permission: ${resource}:${action}`, error);
      return false;
    }
  }
}

export const TenantService_Instance = TenantService.getInstance();
