import { IApplicationQueryService } from '../../ports/output/IApplicationQueryService';

/**
 * AdminApplicationUseCases
 *
 * CRUD + access-management operations on Applications within Tenants.
 * Uses IApplicationQueryService to keep the application layer independent of the ORM.
 */
export class AdminApplicationUseCases {
  constructor(private readonly appQueryService: IApplicationQueryService) { }

  // ── LIST ALL APPS ─────────────────────────────────────────────────────────

  async listApplications(query: any = {}) {
    return this.appQueryService.listApplications(query);
  }

  async getApplicationById(applicationId: string) {
    return this.appQueryService.getApplicationById(applicationId);
  }

  async getApplicationByAppId(appId: string) {
    return this.appQueryService.getApplicationByAppId(appId);
  }

  // ── TENANT APP ACCESS ─────────────────────────────────────────────────────

  async listTenantApps(tenantId: string, onlyEnabled = true) {
    return this.appQueryService.listTenantApps(tenantId, onlyEnabled);
  }

  async addAppToTenant(tenantId: string, applicationId: string) {
    return this.appQueryService.addAppToTenant({ tenantId, applicationId });
  }

  async removeAppFromTenant(tenantId: string, applicationId: string) {
    return this.appQueryService.removeAppFromTenant({ tenantId, applicationId });
  }

  // ── USER APP ACCESS ───────────────────────────────────────────────────────

  async listUsersWithAppAccess(tenantId: string, applicationId: string) {
    return this.appQueryService.listUsersWithAppAccess(tenantId, applicationId);
  }

  async listUserAppsInTenant(userId: string, tenantId: string) {
    return this.appQueryService.listUserAppsInTenant(userId, tenantId);
  }

  async grantUserAppAccess(data: { userId: string; tenantId: string; applicationId: string; grantedBy: string }) {
    return this.appQueryService.grantUserAppAccess(data);
  }

  async grantBulkAppAccess(grants: Array<{ userId: string; tenantId: string; applicationId: string; grantedBy: string }>) {
    return this.appQueryService.grantBulkAppAccess(grants);
  }

  async revokeUserAppAccess(userId: string, tenantId: string, applicationId: string) {
    return this.appQueryService.revokeUserAppAccess(userId, tenantId, applicationId);
  }

  async getTenantMember(tenantId: string, userId: string) {
    return this.appQueryService.getTenantMember(tenantId, userId);
  }

  async getTenantApp(tenantId: string, applicationId: string) {
    return this.appQueryService.getTenantApp(tenantId, applicationId);
  }

  // ── GLOBAL APP CRUD ───────────────────────────────────────────────────────

  async createApplication(data: {
    appId: string; name: string; url: string;
    description?: string; backendUrl?: string;
    audience?: string; scope?: string[];
  }) {
    return this.appQueryService.createApplication(data);
  }

  async updateApplication(applicationId: string, data: {
    name?: string; url?: string; description?: string;
    backendUrl?: string; audience?: string; scope?: string[]; isActive?: boolean;
  }) {
    return this.appQueryService.updateApplication(applicationId, data);
  }

  async deleteApplication(applicationId: string) {
    return this.appQueryService.deleteApplication(applicationId);
  }
}
