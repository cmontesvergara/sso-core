import { PrismaClient } from '@prisma/client';
import {
    CreateTenantData,
    ITenantQueryService,
    TenantAppInput,
    TenantMemberInput,
    TenantWithMembers,
} from '../../../application/ports/output/ITenantQueryService';

export class PrismaTenantQueryService implements ITenantQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async createTenant(data: CreateTenantData, createdBy: string): Promise<any> {
        const slug = data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-');
        return this.prisma.tenant.create({
            data: {
                name: data.name,
                slug,
                members: { create: { userId: createdBy, role: 'admin' } },
            },
            include: { members: true, roles: true },
        });
    }

    async getTenantById(tenantId: string): Promise<TenantWithMembers> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    },
                },
                roles: true,
            },
        });
        if (!tenant) throw new Error('Tenant not found');
        return tenant as TenantWithMembers;
    }

    async getUserTenants(userId: string): Promise<any[]> {
        const memberships = await this.prisma.tenantMember.findMany({
            where: { userId },
            include: { tenant: { include: { _count: { select: { members: true } } } } },
        });
        return memberships.map((m) => ({
            id: m.tenant.id,
            name: m.tenant.name,
            slug: m.tenant.slug,
            role: m.role,
            memberCount: m.tenant._count.members,
        }));
    }

    async listAllTenants(): Promise<any[]> {
        return this.prisma.tenant.findMany({
            include: { _count: { select: { members: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getTenantMembers(tenantId: string): Promise<any[]> {
        return this.prisma.tenantMember.findMany({
            where: { tenantId },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, userStatus: true } } },
        });
    }

    async addTenantMember(input: TenantMemberInput): Promise<any> {
        const existing = await this.prisma.tenantMember.findUnique({
            where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
        });
        if (existing) throw new Error('User is already a member of this tenant');

        return this.prisma.tenantMember.create({
            data: { tenantId: input.tenantId, userId: input.userId, role: input.role ?? 'member' },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        });
    }

    async updateTenantMemberRole(tenantId: string, memberId: string, role: string): Promise<any> {
        return this.prisma.tenantMember.update({
            where: { tenantId_userId: { tenantId, userId: memberId } },
            data: { role },
        });
    }

    async removeTenantMember(tenantId: string, memberId: string): Promise<any> {
        return this.prisma.tenantMember.delete({
            where: { tenantId_userId: { tenantId, userId: memberId } },
        });
    }

    async getTenantApps(tenantId: string): Promise<any[]> {
        const tenantApps = await this.prisma.tenantApp.findMany({
            where: { tenantId, isEnabled: true },
            include: {
                application: {
                    select: { id: true, appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true },
                },
            },
        });
        return tenantApps.map((ta) => ta.application);
    }

    async addAppToTenant(input: TenantAppInput): Promise<any> {
        const existing = await this.prisma.tenantApp.findUnique({
            where: { tenantId_applicationId: { tenantId: input.tenantId, applicationId: input.applicationId } },
        });
        if (existing) {
            if (!existing.isEnabled) {
                return this.prisma.tenantApp.update({
                    where: { tenantId_applicationId: { tenantId: input.tenantId, applicationId: input.applicationId } },
                    data: { isEnabled: true },
                });
            }
            throw new Error('Application already enabled for this tenant');
        }
        return this.prisma.tenantApp.create({
            data: { tenantId: input.tenantId, applicationId: input.applicationId, isEnabled: true },
        });
    }

    async removeAppFromTenant(input: TenantAppInput): Promise<void> {
        await this.prisma.userAppAccess.deleteMany({
            where: { tenantId: input.tenantId, applicationId: input.applicationId },
        });
        await this.prisma.tenantApp.delete({
            where: { tenantId_applicationId: { tenantId: input.tenantId, applicationId: input.applicationId } },
        });
    }

    async updateTenant(tenantId: string, data: { name?: string; slug?: string }): Promise<any> {
        return this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                ...(data.name ? { name: data.name } : {}),
                ...(data.slug ? { slug: data.slug } : {}),
            },
        });
    }

    async deleteTenant(tenantId: string): Promise<any> {
        return this.prisma.tenant.delete({ where: { id: tenantId } });
    }
}
