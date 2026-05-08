import { PrismaClient } from '@prisma/client';

/**
 * AdminAppResourceUseCases
 *
 * Manages the resource/action registry that each application can register
 * and that roles can be granted permissions against.
 */
export class AdminAppResourceUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  /** Resolve an Application row from either a UUID (id) or a string appId. */
  private async resolveApplication(appIdOrId: string) {
    // Try as UUID primary key first
    const byId = await this.prisma.application.findUnique({ where: { id: appIdOrId } });
    if (byId) return byId;
    // Fall back to appId string field
    const byAppId = await this.prisma.application.findUnique({ where: { appId: appIdOrId } });
    return byAppId ?? null;
  }

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
    const application = await this.resolveApplication(data.appId);
    if (!application) throw new Error(`Application not found: ${data.appId}`);

    // Normalize to flat pairs
    const pairs: Array<{ resource: string; action: string }> = [];

    for (const item of data.resources) {
      if ('resource' in item && 'action' in item) {
        // Flat SDK format
        pairs.push({ resource: item.resource, action: item.action });
      } else if ('name' in item && Array.isArray(item.actions)) {
        // Grouped format
        for (const action of item.actions) {
          pairs.push({ resource: item.name, action });
        }
      }
      // Skip malformed entries silently
    }

    const results: any[] = [];

    for (const { resource, action } of pairs) {
      const existing = await this.prisma.appResource.findFirst({
        where: { applicationId: application.id, resource, action },
      });

      if (!existing) {
        const created = await this.prisma.appResource.create({
          data: { applicationId: application.id, resource, action },
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    }

    return results;
  }

  async getAppResources(appIdOrId: string) {
    const application = await this.resolveApplication(appIdOrId);
    if (!application) return []; // return empty instead of 500

    return this.prisma.appResource.findMany({ where: { applicationId: application.id } });
  }

  async getAvailableResourcesForTenant(tenantId: string, userId: string) {
    const member = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!member) throw new Error('User is not a member of this tenant');

    const tenantApps = await this.prisma.tenantApp.findMany({
      where: { tenantId, isEnabled: true },
      select: { applicationId: true },
    });
    const applicationIds = tenantApps.map((ta) => ta.applicationId);

    return this.prisma.appResource.findMany({
      where: { applicationId: { in: applicationIds } },
      include: { application: { select: { appId: true, name: true } } },
    });
  }
}
