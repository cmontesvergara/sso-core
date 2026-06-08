/**
 * IApplicationQueryService
 *
 * Encapsulates complex application queries and mutations for admin operations.
 */

export interface CreateApplicationData {
    appId: string;
    name: string;
    url: string;
    description?: string;
    backendUrl?: string;
    audience?: string;
    scope?: string[];
}

export interface UpdateApplicationData {
    name?: string;
    url?: string;
    description?: string;
    backendUrl?: string;
    audience?: string;
    scope?: string[];
    isActive?: boolean;
}

export interface UserAppAccessInput {
    userId: string;
    tenantId: string;
    applicationId: string;
    grantedBy: string;
}

export interface IApplicationQueryService {
    listApplications(query?: { isActive?: boolean | string }): Promise<any[]>;
    getApplicationById(applicationId: string): Promise<any | null>;
    getApplicationByAppId(appId: string): Promise<any | null>;
    listTenantApps(tenantId: string, onlyEnabled?: boolean): Promise<any[]>;
    addAppToTenant(input: { tenantId: string; applicationId: string }): Promise<any>;
    removeAppFromTenant(input: { tenantId: string; applicationId: string }): Promise<void>;
    listUsersWithAppAccess(tenantId: string, applicationId: string): Promise<any[]>;
    listUserAppsInTenant(userId: string, tenantId: string): Promise<any[]>;
    grantUserAppAccess(input: UserAppAccessInput): Promise<any>;
    grantBulkAppAccess(grants: UserAppAccessInput[]): Promise<number>;
    revokeUserAppAccess(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getTenantMember(tenantId: string, userId: string): Promise<any | null>;
    getTenantApp(tenantId: string, applicationId: string): Promise<any | null>;
    createApplication(data: CreateApplicationData): Promise<any>;
    updateApplication(applicationId: string, data: UpdateApplicationData): Promise<any>;
    deleteApplication(applicationId: string): Promise<any>;
}
