import { StatsResponseDTO } from '../core/dtos/stats.dto';
import { countUsers } from '../repositories/userRepo.prisma';
import { listApplications } from '../repositories/applicationRepo.prisma';
import { countActiveSSOSessions } from '../repositories/ssoSessionRepo.prisma';
import { countAllActiveAppSessions } from '../repositories/appSessionRepo.prisma';

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
        ] = await Promise.all([
            countUsers(),
            countUsers({ userStatus: 'active' }),
            countUsers({ userStatus: 'inactive' }),
            countUsers({ userStatus: 'suspended' }),
            countUsers({ userStatus: 'deleted' }),
            listApplications(),
            countActiveSSOSessions(),
            countAllActiveAppSessions(),
        ]);

        const activeApps = allApps.filter((app) => app.isActive).length;

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
        };
    }
}

export const statsService = new StatsService();
