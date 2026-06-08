/**
 * IAppResourceQueryService
 *
 * Encapsulates app resource registry queries and mutations.
 */

export interface RegisterResourceItem {
    resource?: string;
    action?: string;
    description?: string;
    name?: string;
    actions?: string[];
}

export interface RegisterAppResourcesData {
    appId: string;
    resources: RegisterResourceItem[];
}

export interface IAppResourceQueryService {
    resolveApplication(appIdOrId: string): Promise<any | null>;
    registerAppResources(data: RegisterAppResourcesData): Promise<any[]>;
    getAppResources(appIdOrId: string): Promise<any[]>;
    getAvailableResourcesForTenant(tenantId: string, userId: string): Promise<any[]>;
}
