import { PrismaClient } from '@prisma/client';

/**
 * AdminTenantUseCases
 *
 * Aggregates all tenant-admin operations.
 * Uses PrismaClient directly (no ITenantRepository covers all operations yet).
 */
export class AdminTenantUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  /** Resolve a userId from either an explicit userId or an email address. */
  async resolveUserId(userId?: string, email?: string): Promise<string | null> {
    if (userId) return userId;
    if (!email) return null;
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }

  // ── CREATE TENANT ─────────────────────────────────────────────────────────

  async createTenant(data: { name: string; slug?: string; [k: string]: any }, createdBy: string) {
    const slug = data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-');
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        members: {
          create: { userId: createdBy, role: 'admin' },
        },
      },
      include: { members: true, roles: true },
    });
    return tenant;
  }

  // ── GET TENANT BY ID ──────────────────────────────────────────────────────

  async getTenantById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        members: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        roles:   true,
      },
    });
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  }

  // ── LIST TENANTS FOR USER ─────────────────────────────────────────────────

  async getUserTenants(userId: string) {
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      include: { tenant: { include: { _count: { select: { members: true } } } } },
    });
    return memberships.map((m) => ({
      id:          m.tenant.id,
      name:        m.tenant.name,
      slug:        m.tenant.slug,
      role:        m.role,
      memberCount: m.tenant._count.members,
    }));
  }

  // ── GET ALL TENANTS (admin) ───────────────────────────────────────────────

  async listAllTenants() {
    return this.prisma.tenant.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────

  async getTenantMembers(tenantId: string) {
    return this.prisma.tenantMember.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, userStatus: true } } },
    });
  }

  async addMember(tenantId: string, targetUserId: string, role: string = 'member') {
    const existing = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });
    if (existing) throw new Error('User is already a member of this tenant');

    return this.prisma.tenantMember.create({
      data: { tenantId, userId: targetUserId, role },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async updateMemberRole(tenantId: string, memberId: string, role: string) {
    return this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId: memberId } },
      data: { role },
    });
  }

  async removeMember(tenantId: string, memberId: string) {
    return this.prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId, userId: memberId } },
    });
  }

  // ── TENANT APPS ───────────────────────────────────────────────────────────

  async getTenantApps(tenantId: string) {
    const tenantApps = await this.prisma.tenantApp.findMany({
      where: { tenantId, isEnabled: true },
      include: {
        application: {
          select: { id: true, appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true },
        },
      },
    });
    return tenantApps.map((ta) => ta.application);
  }

  async addAppToTenant(tenantId: string, applicationId: string) {
    const existing = await this.prisma.tenantApp.findUnique({
      where: { tenantId_applicationId: { tenantId, applicationId } },
    });
    if (existing) {
      if (!existing.isEnabled) {
        return this.prisma.tenantApp.update({
          where: { tenantId_applicationId: { tenantId, applicationId } },
          data: { isEnabled: true },
        });
      }
      throw new Error('Application already enabled for this tenant');
    }
    return this.prisma.tenantApp.create({ data: { tenantId, applicationId, isEnabled: true } });
  }

  async removeAppFromTenant(tenantId: string, applicationId: string) {
    // Revoke all user access first
    await this.prisma.userAppAccess.deleteMany({ where: { tenantId, applicationId } });
    await this.prisma.tenantApp.delete({
      where: { tenantId_applicationId: { tenantId, applicationId } },
    });
  }

  // ── UPDATE / DELETE TENANT ────────────────────────────────────────────────

  async updateTenant(tenantId: string, data: { name?: string; slug?: string }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
      },
    });
  }

  async deleteTenant(tenantId: string) {
    // Cascade: members + roles + tenantApps + userAppAccess handled by DB onDelete Cascade
    return this.prisma.tenant.delete({ where: { id: tenantId } });
  }
}
