/**
 * ITenantQueryService
 *
 * Encapsulates complex tenant queries and mutations for admin operations.
 */

export interface CreateTenantData {
    name: string;
    slug?: string;
    [k: string]: any;
}

export interface TenantWithMembers {
    id: string;
    name: string;
    slug: string;
    members: any[];
    roles: any[];
    createdAt: Date;
}

export interface TenantMemberInput {
    tenantId: string;
    userId: string;
    role?: string;
}

export interface TenantAppInput {
    tenantId: string;
    applicationId: string;
}

export interface ITenantQueryService {
    createTenant(data: CreateTenantData, createdBy: string): Promise<any>;
    getTenantById(tenantId: string): Promise<TenantWithMembers>;
    getUserTenants(userId: string): Promise<any[]>;
    listAllTenants(): Promise<any[]>;
    getTenantMembers(tenantId: string): Promise<any[]>;
    addTenantMember(input: TenantMemberInput): Promise<any>;
    updateTenantMemberRole(tenantId: string, memberId: string, role: string): Promise<any>;
    removeTenantMember(tenantId: string, memberId: string): Promise<any>;
    getTenantApps(tenantId: string): Promise<any[]>;
    addAppToTenant(input: TenantAppInput): Promise<any>;
    removeAppFromTenant(input: TenantAppInput): Promise<void>;
    updateTenant(tenantId: string, data: { name?: string; slug?: string }): Promise<any>;
    deleteTenant(tenantId: string): Promise<any>;
}
