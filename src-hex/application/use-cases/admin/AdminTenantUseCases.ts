import { ITenantQueryService } from '../../ports/output/ITenantQueryService';
import { IUserQueryService } from '../../ports/output/IUserQueryService';

/**
 * AdminTenantUseCases
 *
 * Aggregates all tenant-admin operations.
 * Uses ITenantQueryService + IUserQueryService to keep the application layer independent of the ORM.
 */
export class AdminTenantUseCases {
  constructor(
    private readonly tenantQueryService: ITenantQueryService,
    private readonly userQueryService: IUserQueryService,
  ) { }

  /** Resolve a userId from either an explicit userId or an email address. */
  async resolveUserId(userId?: string, email?: string): Promise<string | null> {
    return this.userQueryService.resolveUserId(userId, email);
  }

  // ── CREATE TENANT ─────────────────────────────────────────────────────────

  async createTenant(data: { name: string; slug?: string;[k: string]: any }, createdBy: string) {
    const slug = data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-');
    return this.tenantQueryService.createTenant({ name: data.name, slug }, createdBy);
  }

  // ── GET TENANT BY ID ──────────────────────────────────────────────────────

  async getTenantById(tenantId: string) {
    return this.tenantQueryService.getTenantById(tenantId);
  }

  // ── LIST TENANTS FOR USER ─────────────────────────────────────────────────

  async getUserTenants(userId: string) {
    return this.tenantQueryService.getUserTenants(userId);
  }

  // ── GET ALL TENANTS (admin) ───────────────────────────────────────────────

  async listAllTenants() {
    return this.tenantQueryService.listAllTenants();
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────

  async getTenantMembers(tenantId: string) {
    return this.tenantQueryService.getTenantMembers(tenantId);
  }

  async addMember(tenantId: string, targetUserId: string, role: string = 'member') {
    return this.tenantQueryService.addTenantMember({ tenantId, userId: targetUserId, role });
  }

  async updateMemberRole(tenantId: string, memberId: string, role: string) {
    return this.tenantQueryService.updateTenantMemberRole(tenantId, memberId, role);
  }

  async removeMember(tenantId: string, memberId: string) {
    return this.tenantQueryService.removeTenantMember(tenantId, memberId);
  }

  // ── TENANT APPS ───────────────────────────────────────────────────────────

  async getTenantApps(tenantId: string) {
    return this.tenantQueryService.getTenantApps(tenantId);
  }

  async addAppToTenant(tenantId: string, applicationId: string) {
    return this.tenantQueryService.addAppToTenant({ tenantId, applicationId });
  }

  async removeAppFromTenant(tenantId: string, applicationId: string) {
    return this.tenantQueryService.removeAppFromTenant({ tenantId, applicationId });
  }

  // ── UPDATE / DELETE TENANT ────────────────────────────────────────────────

  async updateTenant(tenantId: string, data: { name?: string; slug?: string }) {
    return this.tenantQueryService.updateTenant(tenantId, data);
  }

  async deleteTenant(tenantId: string) {
    return this.tenantQueryService.deleteTenant(tenantId);
  }
}
