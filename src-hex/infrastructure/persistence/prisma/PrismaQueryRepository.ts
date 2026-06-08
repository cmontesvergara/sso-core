import { PrismaClient } from '@prisma/client';
import { PermissionData, TenantMembershipData, UserContextData } from '../../../application/dto/output/LoginResult';
import { IQueryRepository } from '../../../application/ports/output/IQueryRepository';

/**
 * PrismaQueryRepository
 *
 * Implementation of IQueryRepository using Prisma.
 * Centralizes all complex multi-table queries that don't fit
 * the simple CRUD pattern of domain repositories.
 */
export class PrismaQueryRepository implements IQueryRepository {
    constructor(private prisma: PrismaClient) { }

    async findUserById(userId: string): Promise<UserContextData | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                nuid: true,
                userStatus: true,
                systemRole: true,
            },
        });

        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`,
            nuid: user.nuid,
            userStatus: user.userStatus,
            systemRole: user.systemRole,
        };
    }

    async findFirstTenantMembership(
        userId: string,
        appId?: string
    ): Promise<{ tenantId: string; role: string } | null> {
        const member = await this.prisma.tenantMember.findFirst({
            where: {
                userId,
                tenant: appId
                    ? {
                        tenantApps: {
                            some: {
                                application: { appId },
                                isEnabled: true,
                            },
                        },
                    }
                    : undefined,
            },
            select: { tenantId: true, role: true },
        });

        return member ?? null;
    }

    async findTenantMemberships(
        userId: string,
        appId?: string
    ): Promise<TenantMembershipData[]> {
        const members = await this.prisma.tenantMember.findMany({
            where: {
                userId,
                tenant: appId
                    ? {
                        tenantApps: {
                            some: {
                                application: { appId },
                                isEnabled: true,
                            },
                        },
                    }
                    : undefined,
            },
            include: { tenant: true },
        });

        return members.map((tm: any) => ({
            id: tm.tenant.id,
            name: tm.tenant.name,
            slug: tm.tenant.slug,
            domain: tm.tenant.domain,
            role: tm.role,
        }));
    }

    async findRolePermissions(
        tenantId: string,
        roleName: string,
        appId: string
    ): Promise<PermissionData[]> {
        const roleRecord = await this.prisma.role.findFirst({
            where: { tenantId, name: roleName },
        });

        if (!roleRecord) return [];

        const application = await this.prisma.application.findUnique({
            where: { appId },
            select: { id: true },
        });

        if (!application) return [];

        const permissions = await this.prisma.permission.findMany({
            where: { roleId: roleRecord.id, applicationId: application.id },
            select: { resource: true, action: true },
        });

        return permissions.map((p: any) => ({
            resource: p.resource,
            action: p.action,
        }));
    }

    async findApplicationByAppId(
        appId: string
    ): Promise<{ id: string; audience?: string | null; url?: string | null; backendUrl?: string | null } | null> {
        return this.prisma.application.findUnique({
            where: { appId },
            select: { id: true, audience: true, url: true, backendUrl: true },
        });
    }

    async upsertTenantMember(
        tenantId: string,
        userId: string,
        role: string
    ): Promise<void> {
        await this.prisma.tenantMember.upsert({
            where: {
                tenantId_userId: { tenantId, userId },
            },
            create: {
                tenantId,
                userId,
                role,
                createdAt: new Date(),
            },
            update: { role },
        });
    }

    async updateTenantMemberRole(
        tenantId: string,
        userId: string,
        role: string
    ): Promise<void> {
        await this.prisma.tenantMember.update({
            where: {
                tenantId_userId: { tenantId, userId },
            },
            data: { role },
        });
    }
}
