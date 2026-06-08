import { IAppResourceQueryService } from '../../ports/output/IAppResourceQueryService';

/**
 * AdminAppResourceUseCases
 *
 * Manages the resource/action registry that each application can register
 * and that roles can be granted permissions against.
 * Uses IAppResourceQueryService to keep the application layer independent of the ORM.
 */
export class AdminAppResourceUseCases {
  constructor(private readonly appResourceQueryService: IAppResourceQueryService) { }

  /**
   * Register resources from an app's /api/sso/resources endpoint.
   *
   * Accepts two formats emitted by @bigso/auth-sdk:
   *   Flat (SDK):    { resource: string; action: string; description?: string }
   *   Grouped:       { name: string; actions: string[] }
   */
  async registerAppResources(data: {
    appId: string;
    resources: Array<
      | { resource: string; action: string; description?: string }   // flat (SDK)
      | { name: string; actions: string[] }                          // grouped (legacy)
    >;
  }) {
    return this.appResourceQueryService.registerAppResources(data);
  }

  async getAppResources(appIdOrId: string) {
    return this.appResourceQueryService.getAppResources(appIdOrId);
  }

  async getAvailableResourcesForTenant(tenantId: string, userId: string) {
    return this.appResourceQueryService.getAvailableResourcesForTenant(tenantId, userId);
  }
}
