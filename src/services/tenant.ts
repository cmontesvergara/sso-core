import { CreateTenantInput, InviteTenantMemberInput } from '../core/dtos';
import { findApplicationByAppId } from '../repositories/appResourceRepo.prisma';
import { createDefaultRoles } from '../repositories/roleRepo.prisma';
import {
  addTenantMember,
  createTenant as createTenantRepo,
  findTenantByIdWithRelations,
  findTenantByName,
  findTenantBySlug,
  findTenantMember,
  listTenantMembers,
  listTenants,
  listUserTenants,
  removeTenantMember,
  updateTenantMemberRole,
} from '../repositories/tenantRepo.prisma';
import { createUser as createUserInRepo, findUserByEmail } from '../repositories/userRepo.prisma';
import { generateSlug, generateTempPassword } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Extended CreateTenantInput with required tenant admin
 */
export interface CreateTenantWithAdminInput extends CreateTenantInput {
  tenantAdminEmail: string;
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
   * Create a new tenant with mandatory tenant admin
   * System admin creates tenant and assigns a tenant admin
   */
  async createTenant(
    input: CreateTenantWithAdminInput,
    createdByUserId: string
  ): Promise<{
    id: string;
    name: string;
    slug: string;
    tenantAdmin: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }> {
    try {
      const { tenantAdminEmail, ...tenantData } = input;

      // Check if tenant name or slug already exists
      const existingByName = await findTenantByName(tenantData.name);
      if (existingByName) {
        throw new Error(`Tenant with name "${tenantData.name}" already exists`);
      }

      const slug = tenantData.slug || generateSlug(tenantData.name);
      const existingBySlug = await findTenantBySlug(slug);
      if (existingBySlug) {
        throw new Error(`Tenant with slug "${slug}" already exists`);
      }

      // Find tenant admin user - must exist and be active
      const tenantAdmin = await findUserByEmail(tenantAdminEmail);

      if (!tenantAdmin) {
        throw new Error(
          `User with email "${tenantAdminEmail}" not found. Please ensure the user exists before creating the tenant.`
        );
      }

      if (tenantAdmin.userStatus !== 'active') {
        throw new Error(
          `User "${tenantAdminEmail}" is not active. Only active users can be assigned as tenant admins.`
        );
      }

      // Create tenant
      const tenant = await createTenantRepo({
        name: tenantData.name,
        slug,
      });

      logger.info(`Tenant created: ${tenant.name} (${tenant.id}) by user ${createdByUserId}`);

      // Get SSO application ID for default roles
      const ssoApp = await findApplicationByAppId('sso');

      if (!ssoApp) {
        throw new Error('SSO application not found. Please ensure SSO app is seeded.');
      }

      // Create default roles with permissions
      await createDefaultRoles(tenant.id, ssoApp.id);
      logger.info(`Default roles created for tenant ${tenant.id}`);

      // Add tenant admin as member with admin role
      await addTenantMember({
        tenantId: tenant.id,
        userId: tenantAdmin.id,
        role: 'admin',
      });

      logger.info(`User ${tenantAdmin.email} assigned as admin of tenant ${tenant.id}`);

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tenantAdmin: {
          userId: tenantAdmin.id,
          email: tenantAdmin.email,
          firstName: tenantAdmin.firstName,
          lastName: tenantAdmin.lastName,
        },
      };
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID with members and roles
   */
  async getTenantById(tenantId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    members: unknown[];
    roles: unknown[];
  }> {
    try {
      const tenant = await findTenantByIdWithRelations(tenantId);

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
   * System/Super admins see all tenants, regular users see only their tenants
   */
  async getUserTenants(
    userId: string,
    systemRole?: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      role?: string;
      memberCount: number;
      createdAt: Date;
    }>
  > {
    try {
      // System/Super admins see all tenants
      if (systemRole === 'system_admin' || systemRole === 'super_admin') {
        const allTenants = await listTenants({ take: 1000 });
        return allTenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          role: undefined, // Admins don't have a role as they're not members
          memberCount: t.memberCount || 0,
          createdAt: t.createdAt,
        }));
      }

      // Regular users see only their tenants
      const tenants = await listUserTenants(userId);

      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        memberCount: t.memberCount || 0,
        createdAt: t.createdAt,
      }));
    } catch (error) {
      logger.error(`Failed to get tenants for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Invite user to tenant
   * Only tenant admins can invite
   */
  async inviteTenantMember(
    tenantId: string,
    invitedByUserId: string,
    input: InviteTenantMemberInput
  ): Promise<{
    userId: string;
    email: string;
    role: string;
    tenantId: string;
  }> {
    try {
      // Verify inviter is admin
      const inviterMembership = await findTenantMember(tenantId, invitedByUserId);

      if (!inviterMembership || inviterMembership.role !== 'admin') {
        throw new Error('Only admins can invite members');
      }

      // Get or create user with email
      let user = await findUserByEmail(input.email);

      if (!user) {
        const tempPassword = generateTempPassword();
        user = await createUserInRepo({
          email: input.email,
          password: tempPassword,
          firstName: '',
          lastName: '',
          phone: '0000000000',
          nuid: `INVITE-${Date.now()}`,
        });
        logger.info(`New user created for invite: ${input.email}`);
        // TODO: Send email with temporary password
      }

      // Check if already member
      const existing = await findTenantMember(tenantId, user.id);

      if (existing) {
        throw new Error(`User ${input.email} is already a member of this tenant`);
      }

      // Add to tenant
      await addTenantMember({
        tenantId,
        userId: user.id,
        role: input.role,
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
   * Only admins can update roles, cannot remove last admin
   */
  async updateMemberRole(
    tenantId: string,
    updatedByUserId: string,
    targetUserId: string,
    newRole: 'admin' | 'member' | 'viewer'
  ): Promise<{
    userId: string;
    tenantId: string;
    role: string;
  }> {
    try {
      // Verify updater is admin
      const updaterMembership = await findTenantMember(tenantId, updatedByUserId);

      if (!updaterMembership || updaterMembership.role !== 'admin') {
        throw new Error('Only admins can update member roles');
      }

      // Verify target is member of tenant
      const member = await findTenantMember(tenantId, targetUserId);

      if (!member) {
        throw new Error('User is not a member of this tenant');
      }

      // Prevent removing last admin
      if (member.role === 'admin' && newRole !== 'admin') {
        const members = await listTenantMembers(tenantId);
        const adminCount = members.filter((m) => m.role === 'admin').length;

        if (adminCount === 1) {
          throw new Error('Cannot remove the last admin from tenant');
        }
      }

      // Update role
      await updateTenantMemberRole(tenantId, targetUserId, newRole);

      logger.info(`Member ${targetUserId} role updated to ${newRole} in tenant ${tenantId}`);

      return { userId: targetUserId, tenantId, role: newRole };
    } catch (error) {
      logger.error('Failed to update member role:', error);
      throw error;
    }
  }

  /**
   * Remove member from tenant
   * Only admins can remove, cannot remove last admin
   */
  async removeMember(
    tenantId: string,
    removedByUserId: string,
    targetUserId: string
  ): Promise<{
    success: boolean;
  }> {
    try {
      // Verify remover is admin
      const removerMembership = await findTenantMember(tenantId, removedByUserId);

      if (!removerMembership || removerMembership.role !== 'admin') {
        throw new Error('Only admins can remove members');
      }

      // Get member to remove
      const member = await findTenantMember(tenantId, targetUserId);

      if (!member) {
        throw new Error('User is not a member of this tenant');
      }

      // Prevent removing last admin
      if (member.role === 'admin') {
        const members = await listTenantMembers(tenantId);
        const adminCount = members.filter((m) => m.role === 'admin').length;

        if (adminCount === 1) {
          throw new Error('Cannot remove the last admin from tenant');
        }
      }

      // Remove
      await removeTenantMember(tenantId, targetUserId);

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
  async getTenantMembers(tenantId: string): Promise<
    Array<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      joinedAt: Date;
    }>
  > {
    try {
      const members = await listTenantMembers(tenantId);

      return members.map((m) => ({
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
}

export const TenantService_Instance = TenantService.getInstance();
