import {
    bulkCreateAppResources,
    findAppResource,
    findApplicationByAppId,
    findTenantApp,
    listAppResources,
    listResourcesByTenant,
} from '../repositories/appResourceRepo.prisma';
import { findTenantById, findTenantMember } from '../repositories/tenantRepo.prisma';
import { logger } from '../utils/logger';

export interface RegisterAppResourcesInput {
  appId: string;
  resources: Array<{
    resource: string;
    action: string;
    category?: string;
    description?: string;
  }>;
}

export interface AppResourceInfo {
  resource: string;
  action: string;
  category: string | null;
  description: string | null;
  applicationName: string;
  appId: string;
}

/**
 * App Resource Service
 * Manages the catalog of resources and actions available per application
 */
export class AppResourceService {
  private static instance: AppResourceService;

  private constructor() {}

  static getInstance(): AppResourceService {
    if (!AppResourceService.instance) {
      AppResourceService.instance = new AppResourceService();
    }
    return AppResourceService.instance;
  }

  /**
   * Register or update resources for an application
   * This is typically called when an application starts up or during deployment
   * to ensure its resource catalog is up to date
   */
  async registerAppResources(input: RegisterAppResourcesInput): Promise<{
    applicationId: string;
    appId: string;
    resourcesRegistered: number;
  }> {
    try {
      const { appId, resources } = input;

      // Find application
      const application = await findApplicationByAppId(appId);
      if (!application) {
        throw new Error(`Application with appId "${appId}" not found`);
      }

      // Bulk upsert resources
      const result = await bulkCreateAppResources(application.id, resources);

      logger.info(
        `Registered ${result.length} resources for application ${appId} (${application.id})`
      );

      return {
        applicationId: application.id,
        appId: application.appId,
        resourcesRegistered: result.length,
      };
    } catch (error) {
      logger.error('Failed to register app resources:', error);
      throw error;
    }
  }

  /**
   * Get all resources for a specific application
   */
  async getAppResources(appId: string): Promise<AppResourceInfo[]> {
    try {
      // Find application
      const application = await findApplicationByAppId(appId);
      if (!application) {
        throw new Error(`Application with appId "${appId}" not found`);
      }

      // Get resources
      const resources = await listAppResources(application.id);

      return resources.map((r) => ({
        resource: r.resource,
        action: r.action,
        category: r.category,
        description: r.description,
        applicationName: application.name,
        appId: application.appId,
      }));
    } catch (error) {
      logger.error(`Failed to get resources for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Get all available resources for a tenant
   * Returns only resources from applications that are enabled for the tenant
   */
  async getAvailableResourcesForTenant(
    tenantId: string,
    userId: string
  ): Promise<AppResourceInfo[]> {
    try {
      // Verify tenant exists
      const tenant = await findTenantById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Verify user is member of the tenant
      const membership = await findTenantMember(tenantId, userId);
      if (!membership) {
        throw new Error('User is not a member of this tenant');
      }

      // Get resources for tenant's enabled apps
      const resources = await listResourcesByTenant(tenantId);

      return resources.map((r) => ({
        resource: r.resource,
        action: r.action,
        category: r.category,
        description: r.description,
        applicationName: r.applicationName,
        appId: r.appId,
      }));
    } catch (error) {
      logger.error(`Failed to get available resources for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Validate if a resource/action exists in an application's catalog
   * Used before creating permissions to ensure they reference valid resources
   */
  async validatePermission(
    appId: string,
    resource: string,
    action: string
  ): Promise<{
    valid: boolean;
    applicationId?: string;
    message?: string;
  }> {
    try {
      // Find application
      const application = await findApplicationByAppId(appId);
      if (!application) {
        return {
          valid: false,
          message: `Application with appId "${appId}" not found`,
        };
      }

      // Check if resource exists
      const appResource = await findAppResource(application.id, resource, action);

      if (!appResource) {
        return {
          valid: false,
          message: `Resource "${resource}:${action}" is not registered for application "${appId}"`,
        };
      }

      return {
        valid: true,
        applicationId: application.id,
      };
    } catch (error) {
      logger.error('Failed to validate permission:', error);
      throw error;
    }
  }

  /**
   * Validate if a tenant has access to a specific application
   */
  async validateTenantAccess(
    tenantId: string,
    appId: string
  ): Promise<{
    valid: boolean;
    message?: string;
  }> {
    try {
      // Find application
      const application = await findApplicationByAppId(appId);
      if (!application) {
        return {
          valid: false,
          message: `Application with appId "${appId}" not found`,
        };
      }

      // Check if tenant has app enabled
      const tenantApp = await findTenantApp(tenantId, application.id);

      if (!tenantApp) {
        return {
          valid: false,
          message: `Tenant does not have access to application "${appId}"`,
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      logger.error('Failed to validate tenant access:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const appResourceService = AppResourceService.getInstance();
