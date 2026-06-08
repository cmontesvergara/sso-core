import { PrismaClient } from '@prisma/client';
import {
    AddressInput,
    IUserQueryService,
    ListUsersQuery,
    PaginatedUsersResult,
    UpdateProfileData,
} from '../../../application/ports/output/IUserQueryService';

export class PrismaUserQueryService implements IUserQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async listUsers(query: ListUsersQuery): Promise<PaginatedUsersResult> {
        const page = Math.max(1, parseInt(query.page as string ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit as string ?? '20', 10)));
        const skip = (page - 1) * limit;
        const search = query.search as string | undefined;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { nuid: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (query.userStatus) where.userStatus = query.userStatus;
        if (query.status) where.userStatus = query.status;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, email: true, firstName: true, secondName: true,
                    lastName: true, secondLastName: true, phone: true, nuid: true,
                    userStatus: true, createdAt: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            users,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async getUserById(userId: string): Promise<any | null> {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: { addresses: true },
        });
    }

    async getUserTenantsWithApps(userId: string): Promise<any[]> {
        const memberships = await this.prisma.tenantMember.findMany({
            where: { userId },
            include: { tenant: true },
        });

        return Promise.all(
            memberships.map(async (m) => {
                const userAppAccess = await this.prisma.userAppAccess.findMany({
                    where: { userId, tenantId: m.tenantId },
                    include: {
                        application: {
                            select: { appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true },
                        },
                    },
                });

                return {
                    tenantId: m.tenant.id,
                    name: m.tenant.name,
                    slug: m.tenant.slug,
                    role: m.role,
                    apps: userAppAccess
                        .filter((ua) => ua.application.isActive)
                        .map((ua) => ({
                            appId: ua.application.appId,
                            name: ua.application.name,
                            url: ua.application.url,
                            description: ua.application.description ?? '',
                            logoUrl: ua.application.logoUrl ?? null,
                        })),
                };
            })
        );
    }

    async updateProfile(
        userId: string,
        data: UpdateProfileData,
        addresses?: AddressInput[]
    ): Promise<any> {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                ...data,
                ...(addresses !== undefined ? {
                    addresses: { deleteMany: {}, create: addresses },
                } : {}),
            },
            include: { addresses: true },
        });
    }

    async updateUserStatus(userId: string, status: string): Promise<any> {
        return this.prisma.user.update({
            where: { id: userId },
            data: { userStatus: status },
        });
    }

    async resolveUserId(userId?: string, email?: string): Promise<string | null> {
        if (userId) return userId;
        if (!email) return null;
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        return user?.id ?? null;
    }
}
