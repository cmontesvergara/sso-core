import { StatsResponseDTO } from '../core/dtos/stats.dto';
import { countUsers } from '../repositories/userRepo.prisma';
import { listApplications } from '../repositories/applicationRepo.prisma';
import { countActiveSSOSessions } from '../repositories/ssoSessionRepo.prisma';
import { countAllActiveAppSessions, countActiveAppSessionsGroupedByApp } from '../repositories/appSessionRepo.prisma';

export class StatsService {
    /**
     * Aggregate robust system statistics suitable for an admin dashboard.
     */
    async getGlobalStats(): Promise<StatsResponseDTO> {
        const [
            totalUsers,
            activeUsers,
            inactiveUsers,
            suspendedUsers,
            deletedUsers,
            allApps,
            activeSsoSessions,
            activeAppSessions,
            groupedAppSessions,
        ] = await Promise.all([
            countUsers(),
            countUsers({ userStatus: 'active' }),
            countUsers({ userStatus: 'inactive' }),
            countUsers({ userStatus: 'suspended' }),
            countUsers({ userStatus: 'deleted' }),
            listApplications(),
            countActiveSSOSessions(),
            countAllActiveAppSessions(),
            countActiveAppSessionsGroupedByApp(),
        ]);

        const activeApps = allApps.filter((app) => app.isActive).length;

        // Map grouped sessions to include application names
        const appSessionsDetails = groupedAppSessions.map(group => {
            const app = allApps.find(a => a.appId === group.appId);
            return {
                appId: group.appId,
                appName: app ? app.name : group.appId,
                activeSessions: group._count.appId
            };
        });

        return {
            totalUsers,
            activeUsers,
            inactiveUsers,
            suspendedUsers,
            deletedUsers,
            totalApps: allApps.length,
            activeApps,
            activeSsoSessions,
            activeAppSessions,
            appSessionsDetails,
        };
    }
}

export const statsService = new StatsService();
