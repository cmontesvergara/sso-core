import { PrismaClient } from '@prisma/client';

/**
 * AdminApplicationUseCases
 *
 * CRUD + access-management operations on Applications within Tenants.
 * All authorization checks are role-agnostic (systemRole deprecated).
 */
export class AdminApplicationUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  // ── LIST ALL APPS ─────────────────────────────────────────────────────────

  async listApplications(query: any = {}) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true' || query.isActive === true;
    return this.prisma.application.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getApplicationById(applicationId: string) {
    return this.prisma.application.findUnique({ where: { id: applicationId } });
  }

  async getApplicationByAppId(appId: string) {
    return this.prisma.application.findUnique({ where: { appId } });
  }

  // ── TENANT APP ACCESS ─────────────────────────────────────────────────────

  async listTenantApps(tenantId: string, onlyEnabled = true) {
    return this.prisma.tenantApp.findMany({
      where: { tenantId, ...(onlyEnabled ? { isEnabled: true } : {}) },
      include: { application: true },
    });
  }

  async addAppToTenant(tenantId: string, applicationId: string) {
    return this.prisma.tenantApp.upsert({
      where:  { tenantId_applicationId: { tenantId, applicationId } },
      create: { tenantId, applicationId, isEnabled: true },
      update: { isEnabled: true },
    });
  }

  async removeAppFromTenant(tenantId: string, applicationId: string) {
    await this.prisma.userAppAccess.deleteMany({ where: { tenantId, applicationId } });
    return this.prisma.tenantApp.delete({
      where: { tenantId_applicationId: { tenantId, applicationId } },
    });
  }

  // ── USER APP ACCESS ───────────────────────────────────────────────────────

  async listUsersWithAppAccess(tenantId: string, applicationId: string) {
    return this.prisma.userAppAccess.findMany({
      where: { tenantId, applicationId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, userStatus: true } },
      },
    });
  }

  async listUserAppsInTenant(userId: string, tenantId: string) {
    return this.prisma.userAppAccess.findMany({
      where: { userId, tenantId },
      include: { application: { select: { appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true } } },
    });
  }

  async grantUserAppAccess(data: { userId: string; tenantId: string; applicationId: string; grantedBy: string }) {
    const existing = await this.prisma.userAppAccess.findUnique({
      where: { userId_tenantId_applicationId: { userId: data.userId, tenantId: data.tenantId, applicationId: data.applicationId } },
    });
    if (existing) throw new Error('User already has access to this application');
    return this.prisma.userAppAccess.create({ data });
  }

  async grantBulkAppAccess(grants: Array<{ userId: string; tenantId: string; applicationId: string; grantedBy: string }>) {
    const results = await Promise.allSettled(
      grants.map((g) =>
        this.prisma.userAppAccess.upsert({
          where:  { userId_tenantId_applicationId: { userId: g.userId, tenantId: g.tenantId, applicationId: g.applicationId } },
          create: g,
          update: {},
        })
      )
    );
    return results.filter((r) => r.status === 'fulfilled').length;
  }

  async revokeUserAppAccess(userId: string, tenantId: string, applicationId: string) {
    return this.prisma.userAppAccess.delete({
      where: { userId_tenantId_applicationId: { userId, tenantId, applicationId } },
    });
  }

  async getTenantMember(tenantId: string, userId: string) {
    return this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }

  async getTenantApp(tenantId: string, applicationId: string) {
    return this.prisma.tenantApp.findUnique({
      where: { tenantId_applicationId: { tenantId, applicationId } },
    });
  }

  // ── GLOBAL APP CRUD ───────────────────────────────────────────────────────

  async createApplication(data: {
    appId: string; name: string; url: string;
    description?: string; backendUrl?: string;
    audience?: string; scope?: string[];
  }) {
    return this.prisma.application.create({ data: { ...data, isActive: true } });
  }

  async updateApplication(applicationId: string, data: {
    name?: string; url?: string; description?: string;
    backendUrl?: string; audience?: string; scope?: string[]; isActive?: boolean;
  }) {
    return this.prisma.application.update({ where: { id: applicationId }, data });
  }

  async deleteApplication(applicationId: string) {
    return this.prisma.application.delete({ where: { id: applicationId } });
  }
}
