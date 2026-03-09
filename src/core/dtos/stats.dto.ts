/**
 * Statistics Data Transfer Objects
 */

export interface StatsResponseDTO {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    deletedUsers: number;

    totalApps: number;
    activeApps: number;

    activeSsoSessions: number;
    activeAppSessions: number;
}
