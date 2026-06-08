import { PrismaClient } from '@prisma/client';
import {
    IAppResourceQueryService,
    RegisterAppResourcesData,
} from '../../../application/ports/output/IAppResourceQueryService';

export class PrismaAppResourceQueryService implements IAppResourceQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async resolveApplication(appIdOrId: string): Promise<any | null> {
        const byId = await this.prisma.application.findUnique({ where: { id: appIdOrId } });
        if (byId) return byId;
        return this.prisma.application.findUnique({ where: { appId: appIdOrId } });
    }

    async registerAppResources(data: RegisterAppResourcesData): Promise<any[]> {
        const application = await this.resolveApplication(data.appId);
        if (!application) throw new Error(`Application not found: ${data.appId}`);

        const pairs: Array<{ resource: string; action: string }> = [];

        for (const item of data.resources) {
            if ('resource' in item && 'action' in item) {
                pairs.push({ resource: item.resource!, action: item.action! });
            } else if ('name' in item && Array.isArray(item.actions)) {
                for (const action of item.actions!) {
                    pairs.push({ resource: item.name!, action });
                }
            }
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

    async getAppResources(appIdOrId: string): Promise<any[]> {
        const application = await this.resolveApplication(appIdOrId);
        if (!application) return [];
        return this.prisma.appResource.findMany({
            where: { applicationId: application.id },
        });
    }

    async getAvailableResourcesForTenant(tenantId: string, userId: string): Promise<any[]> {
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
