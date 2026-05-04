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

  async registerAppResources(data: {
    appId: string;
    resources: Array<{ name: string; actions: string[] }>;
  }) {
    const application = await this.resolveApplication(data.appId);
    if (!application) throw new Error(`Application not found: ${data.appId}`);

    const results: any[] = [];

    for (const resource of data.resources) {
      for (const action of resource.actions) {
        const existing = await this.prisma.appResource.findFirst({
          where: { applicationId: application.id, resource: resource.name, action },
        });

        if (!existing) {
          const created = await this.prisma.appResource.create({
            data: { applicationId: application.id, resource: resource.name, action },
          });
          results.push(created);
        } else {
          results.push(existing);
        }
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
