/**
 * IRoleQueryService
 *
 * Encapsulates complex role queries and mutations for admin operations.
 */

export interface CreateRoleData {
    name: string;
    tenantId: string;
}

export interface UpdateRoleData {
    name?: string;
    description?: string;
}

export interface PermissionInput {
    applicationId: string;
    resource: string;
    action: string;
}

export interface IRoleQueryService {
    createRole(data: CreateRoleData, createdBy: string): Promise<any>;
    getTenantRoles(tenantId: string): Promise<any[]>;
    getAllRoles(tenantId?: string): Promise<any[]>;
    getRoleById(roleId: string): Promise<any>;
    updateRole(roleId: string, data: UpdateRoleData): Promise<any>;
    deleteRole(roleId: string): Promise<any>;
    addPermission(roleId: string, data: PermissionInput): Promise<any>;
    getRolePermissions(roleId: string): Promise<any[]>;
    removePermission(permissionId: string): Promise<any>;
    removePermissionByResourceAction(roleId: string, applicationId: string, resource: string, action: string): Promise<any>;
}
