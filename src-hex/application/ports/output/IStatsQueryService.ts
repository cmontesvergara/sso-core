/**
 * IStatsQueryService
 *
 * Encapsulates global platform statistics queries.
 */

export interface GlobalStatsResult {
    users: { total: number; active: number };
    tenants: { total: number };
    applications: { total: number };
    sessions: { active: number };
}

export interface IStatsQueryService {
    getGlobalStats(): Promise<GlobalStatsResult>;
}
