import { IRoleQueryService } from '../../ports/output/IRoleQueryService';

/**
 * AdminRoleUseCases
 *
 * CRUD operations for roles and their permissions within tenants.
 * Uses IRoleQueryService to keep the application layer independent of the ORM.
 */
export class AdminRoleUseCases {
  constructor(private readonly roleQueryService: IRoleQueryService) { }

  async createRole(data: { name: string; tenantId: string }, createdBy: string) {
    return this.roleQueryService.createRole(data, createdBy);
  }

  async getTenantRoles(tenantId: string) {
    return this.roleQueryService.getTenantRoles(tenantId);
  }

  async getAllRoles(tenantId?: string) {
    return this.roleQueryService.getAllRoles(tenantId);
  }

  async getRoleById(roleId: string) {
    return this.roleQueryService.getRoleById(roleId);
  }

  async updateRole(roleId: string, data: { name?: string; description?: string }) {
    return this.roleQueryService.updateRole(roleId, data);
  }

  async deleteRole(roleId: string) {
    return this.roleQueryService.deleteRole(roleId);
  }

  // ── PERMISSIONS ───────────────────────────────────────────────────────────

  async addPermission(roleId: string, data: {
    applicationId: string;
    resource: string;
    action: string;
  }) {
    return this.roleQueryService.addPermission(roleId, data);
  }

  async getRolePermissions(roleId: string) {
    return this.roleQueryService.getRolePermissions(roleId);
  }

  async removePermission(permissionId: string) {
    return this.roleQueryService.removePermission(permissionId);
  }

  async removePermissionByResourceAction(
    roleId: string, applicationId: string, resource: string, action: string
  ) {
    return this.roleQueryService.removePermissionByResourceAction(roleId, applicationId, resource, action);
  }
}
