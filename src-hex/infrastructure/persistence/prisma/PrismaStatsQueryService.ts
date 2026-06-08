import { PrismaClient } from '@prisma/client';
import {
    GlobalStatsResult,
    IStatsQueryService,
} from '../../../application/ports/output/IStatsQueryService';

export class PrismaStatsQueryService implements IStatsQueryService {
    constructor(private readonly prisma: PrismaClient) { }

    async getGlobalStats(): Promise<GlobalStatsResult> {
        const [totalUsers, activeUsers, totalTenants, totalApplications, totalSessions] =
            await Promise.all([
                this.prisma.user.count(),
                this.prisma.user.count({ where: { userStatus: 'ACTIVE' } }),
                this.prisma.tenant.count(),
                this.prisma.application.count({ where: { isActive: true } }),
                this.prisma.appSession.count({
                    where: { expiresAt: { gt: new Date() } },
                }),
            ]);

        return {
            users: { total: totalUsers, active: activeUsers },
            tenants: { total: totalTenants },
            applications: { total: totalApplications },
            sessions: { active: totalSessions },
        };
    }
}
