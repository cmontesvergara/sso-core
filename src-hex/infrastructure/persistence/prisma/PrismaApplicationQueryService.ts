import { PrismaClient } from '@prisma/client';
import {
    CreateApplicationData,
    IApplicationQueryService,
    UpdateApplicationData,
    UserAppAccessInput,
} from '../../../application/ports/output/IApplicationQueryService';

export class PrismaApplicationQueryService implements IApplicationQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async listApplications(query?: { isActive?: boolean | string }): Promise<any[]> {
        const where: any = {};
        if (query?.isActive !== undefined) {
            where.isActive = query.isActive === true || query.isActive === 'true';
        }
        return this.prisma.application.findMany({ where, orderBy: { createdAt: 'desc' } });
    }

    async getApplicationById(applicationId: string): Promise<any | null> {
        return this.prisma.application.findUnique({ where: { id: applicationId } });
    }

    async getApplicationByAppId(appId: string): Promise<any | null> {
        return this.prisma.application.findUnique({ where: { appId } });
    }

    async listTenantApps(tenantId: string, onlyEnabled = true): Promise<any[]> {
        return this.prisma.tenantApp.findMany({
            where: { tenantId, ...(onlyEnabled ? { isEnabled: true } : {}) },
            include: { application: true },
        });
    }

    async addAppToTenant(input: { tenantId: string; applicationId: string }): Promise<any> {
        return this.prisma.tenantApp.upsert({
            where: { tenantId_applicationId: { tenantId: input.tenantId, applicationId: input.applicationId } },
            create: { tenantId: input.tenantId, applicationId: input.applicationId, isEnabled: true },
            update: { isEnabled: true },
        });
    }

    async removeAppFromTenant(input: { tenantId: string; applicationId: string }): Promise<void> {
        await this.prisma.userAppAccess.deleteMany({
            where: { tenantId: input.tenantId, applicationId: input.applicationId },
        });
        await this.prisma.tenantApp.delete({
            where: { tenantId_applicationId: { tenantId: input.tenantId, applicationId: input.applicationId } },
        });
    }

    async listUsersWithAppAccess(tenantId: string, applicationId: string): Promise<any[]> {
        return this.prisma.userAppAccess.findMany({
            where: { tenantId, applicationId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, userStatus: true } },
            },
        });
    }

    async listUserAppsInTenant(userId: string, tenantId: string): Promise<any[]> {
        return this.prisma.userAppAccess.findMany({
            where: { userId, tenantId },
            include: { application: { select: { appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true } } },
        });
    }

    async grantUserAppAccess(input: UserAppAccessInput): Promise<any> {
        const existing = await this.prisma.userAppAccess.findUnique({
            where: { userId_tenantId_applicationId: { userId: input.userId, tenantId: input.tenantId, applicationId: input.applicationId } },
        });
        if (existing) throw new Error('User already has access to this application');
        return this.prisma.userAppAccess.create({ data: input });
    }

    async grantBulkAppAccess(grants: UserAppAccessInput[]): Promise<number> {
        const results = await Promise.allSettled(
            grants.map((g) =>
                this.prisma.userAppAccess.upsert({
                    where: { userId_tenantId_applicationId: { userId: g.userId, tenantId: g.tenantId, applicationId: g.applicationId } },
                    create: g,
                    update: {},
                })
            )
        );
        return results.filter((r) => r.status === 'fulfilled').length;
    }

    async revokeUserAppAccess(userId: string, tenantId: string, applicationId: string): Promise<any> {
        return this.prisma.userAppAccess.delete({
            where: { userId_tenantId_applicationId: { userId, tenantId, applicationId } },
        });
    }

    async getTenantMember(tenantId: string, userId: string): Promise<any | null> {
        return this.prisma.tenantMember.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
        });
    }

    async getTenantApp(tenantId: string, applicationId: string): Promise<any | null> {
        return this.prisma.tenantApp.findUnique({
            where: { tenantId_applicationId: { tenantId, applicationId } },
        });
    }

    async createApplication(data: CreateApplicationData): Promise<any> {
        return this.prisma.application.create({ data: { ...data, isActive: true } });
    }

    async updateApplication(applicationId: string, data: UpdateApplicationData): Promise<any> {
        return this.prisma.application.update({ where: { id: applicationId }, data });
    }

    async deleteApplication(applicationId: string): Promise<any> {
        return this.prisma.application.delete({ where: { id: applicationId } });
    }
}
