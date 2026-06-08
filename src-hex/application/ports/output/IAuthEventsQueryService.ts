/**
 * IAuthEventsQueryService
 *
 * Encapsulates audit log aggregation queries for the activity dashboard.
 */

export interface AuthEventSummaryInput {
    tenantId?: string;
    userId?: string;
    days?: number;
    action?: string;
}

export interface AuthEventSummaryResult {
    byAction: Array<{ action: string; count: number }>;
    timeline: Array<{ date: string; action: string; count: number }>;
    topUsers: Array<{ userId: string | null; email: string; firstName: string; lastName: string; count: number }>;
    tenants: Array<{ id: string; name: string; slug: string }>;
    tenantUsers: Array<{ id: string; email: string; firstName: string; lastName: string }>;
    recentLogs: any[];
}

export interface IAuthEventsQueryService {
    getAuthEventSummary(input: AuthEventSummaryInput): Promise<AuthEventSummaryResult>;
}
