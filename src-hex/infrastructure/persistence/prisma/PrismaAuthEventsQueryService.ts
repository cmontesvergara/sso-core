import { Prisma, PrismaClient } from '@prisma/client';
import {
    AuthEventSummaryInput,
    AuthEventSummaryResult,
    IAuthEventsQueryService,
} from '../../../application/ports/output/IAuthEventsQueryService';

const AUTH_ACTIONS = [
    'LOGIN',
    'AUTH_SUCCESS',
    'TOKEN_REFRESH',
    'SESSION_CONTEXT',
    'LOGOUT',
    'AUTH_FAILURE',
    'REFRESH_FAILURE',
    'SESSION_CONTEXT_FAILURE',
    'SESSION_EXPIRED',
    'SECURITY_TOKEN_REUSE_DETECTED',
    'RATE_LIMIT_BLOCKED',
] as const;

export class PrismaAuthEventsQueryService implements IAuthEventsQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async getAuthEventSummary(input: AuthEventSummaryInput): Promise<AuthEventSummaryResult> {
        const days = input.days ?? 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const auditWhere: any = {
            createdAt: { gte: since },
            action: { in: AUTH_ACTIONS as unknown as string[] },
        };
        if (input.userId) {
            auditWhere.userId = input.userId;
        } else if (input.tenantId) {
            auditWhere.tenantId = input.tenantId;
        }

        const byAction = await this.prisma.auditLog.groupBy({
            by: ['action'],
            where: auditWhere,
            _count: { action: true },
            orderBy: { _count: { action: 'desc' } },
        });

        let userFilter = Prisma.empty;
        if (input.userId) {
            userFilter = Prisma.sql`AND user_id = ${input.userId}::uuid`;
        } else if (input.tenantId) {
            userFilter = Prisma.sql`AND tenant_id = ${input.tenantId}::uuid`;
        }

        const timeline: Array<{ date: string; action: string; count: number }> =
            await this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::date::text AS date,
          action,
          COUNT(*)::int AS count
        FROM audit_logs
        WHERE created_at >= ${since}
          AND action IN (${Prisma.join([...AUTH_ACTIONS])})
          ${userFilter}
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `;

        const topUsersRaw = !input.userId
            ? await this.prisma.auditLog.groupBy({
                by: ['userId'],
                where: { ...auditWhere, userId: { not: null } },
                _count: { userId: true },
                orderBy: { _count: { userId: 'desc' } },
                take: 10,
            })
            : [];

        const topUserIds = topUsersRaw
            .map((r: any) => r.userId)
            .filter(Boolean) as string[];

        const topUserData = topUserIds.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: topUserIds } },
                select: { id: true, email: true, firstName: true, lastName: true },
            })
            : [];

        const topUsers = topUsersRaw.map((r: any) => {
            const u = topUserData.find((u: any) => u.id === r.userId);
            return {
                userId: r.userId,
                email: u?.email ?? '(desconocido)',
                firstName: u?.firstName ?? '',
                lastName: u?.lastName ?? '',
                count: r._count.userId,
            };
        });

        const tenants = await this.prisma.tenant.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });

        let tenantUsers: Array<{ id: string; email: string; firstName: string; lastName: string }> = [];
        if (input.tenantId) {
            tenantUsers = await this.prisma.user.findMany({
                where: { tenantMembers: { some: { tenantId: input.tenantId } } },
                select: { id: true, email: true, firstName: true, lastName: true },
                orderBy: { email: 'asc' },
            });
        }

        const recentWhere = { ...auditWhere };
        if (input.action) {
            recentWhere.action = input.action;
        }

        const recentLogs = await this.prisma.auditLog.findMany({
            where: recentWhere,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return {
            byAction: byAction.map((r: any) => ({ action: r.action, count: r._count.action })),
            timeline,
            topUsers,
            tenants,
            tenantUsers,
            recentLogs,
        };
    }
}
