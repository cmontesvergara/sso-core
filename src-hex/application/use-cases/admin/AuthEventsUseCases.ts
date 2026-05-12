import { PrismaClient, Prisma } from '@prisma/client';

export interface AuthEventSummaryInput {
  tenantId?: string;
  userId?: string;
  days?: number;
}

const AUTH_ACTIONS = [
  'LOGIN',
  'AUTH_SUCCESS',
  'TOKEN_REFRESH',
  'TOKEN_REFRESH_V2',
  'SESSION_CONTEXT',
  'LOGOUT',
  'AUTH_FAILURE',
  'REFRESH_FAILURE',
  'SESSION_CONTEXT_FAILURE',
  'SESSION_EXPIRED',
  'SECURITY_TOKEN_REUSE_DETECTED',
] as const;

const ACTION_LABELS: Record<string, string> = {
  LOGIN:                         'Inicio de sesión',
  AUTH_SUCCESS:                  'Autenticación exitosa',
  TOKEN_REFRESH:                 'Refresh de token',
  TOKEN_REFRESH_V2:              'Refresh (legacy)',
  SESSION_CONTEXT:               'Consulta de sesión',
  LOGOUT:                        'Cierre de sesión',
  AUTH_FAILURE:                  'Fallo de autenticación',
  REFRESH_FAILURE:               'Fallo de refresh',
  SESSION_CONTEXT_FAILURE:       'Fallo de consulta de sesión',
  SESSION_EXPIRED:               'Sesión expirada',
  SECURITY_TOKEN_REUSE_DETECTED: 'Reutilización de token',
};

/**
 * AuthEventsUseCases
 *
 * Produces structured event data for the SSO Manager activity dashboard.
 * Aggregates AuditLog entries by action, date, tenant, and user.
 */
export class AuthEventsUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async getAuthEventSummary(input: AuthEventSummaryInput) {
    const days  = input.days  ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Base where clause for audit logs
    const auditWhere: any = {
      createdAt: { gte: since },
      action:    { in: AUTH_ACTIONS as unknown as string[] },
    };
    if (input.userId) {
      auditWhere.userId = input.userId;
    } else if (input.tenantId) {
      auditWhere.tenantId = input.tenantId;
    }

    // ── Totals by event type ───────────────────────────────────────────────────
    const byAction = await this.prisma.auditLog.groupBy({
      by:       ['action'],
      where:    auditWhere,
      _count:   { action: true },
      orderBy:  { _count: { action: 'desc' } },
    });

    // ── Timeline: count per day per action (last N days) ─────────────────────
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

    // ── Top users (if no userId filter) ───────────────────────────────────────
    const topUsersRaw = !input.userId
      ? await this.prisma.auditLog.groupBy({
          by:      ['userId'],
          where:   { ...auditWhere, userId: { not: null } },
          _count:  { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take:    10,
        })
      : [];

    const topUserIds = topUsersRaw
      .map((r: any) => r.userId)
      .filter(Boolean) as string[];

    const topUserData = topUserIds.length > 0
      ? await this.prisma.user.findMany({
          where:  { id: { in: topUserIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];

    const topUsers = topUsersRaw.map((r: any) => {
      const u = topUserData.find((u: any) => u.id === r.userId);
      return {
        userId:    r.userId,
        email:     u?.email    ?? '(desconocido)',
        firstName: u?.firstName ?? '',
        lastName:  u?.lastName  ?? '',
        count:     r._count.userId,
      };
    });

    // ── Tenant list (for the filter dropdown) ────────────────────────────────
    const tenants = await this.prisma.tenant.findMany({
      select:  { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    // ── Users per tenant (for the user dropdown when tenant is selected) ──────
    let tenantUsers: Array<{ id: string; email: string; firstName: string; lastName: string }> = [];
    if (input.tenantId) {
      tenantUsers = await this.prisma.user.findMany({
        where:   { tenantMembers: { some: { tenantId: input.tenantId } } },
        select:  { id: true, email: true, firstName: true, lastName: true },
        orderBy: { email: 'asc' },
      });
    }

    // ── Recent raw events ────────────────────────────────────────────────────
    const recentLogs = await this.prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const logUserIds = [...new Set(recentLogs.map((l: any) => l.userId).filter(Boolean))] as string[];
    const logUsers = logUserIds.length > 0 
      ? await this.prisma.user.findMany({
          where: { id: { in: logUserIds } },
          select: { id: true, email: true }
        })
      : [];

    const recentEvents = recentLogs.map((log: any) => {
      const u = logUsers.find((u: any) => u.id === log.userId);
      return {
        id: log.id,
        action: log.action,
        userId: log.userId,
        tenantId: log.tenantId,
        email: u?.email || null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        metadata: log.metadata,
      };
    });

    // ── Format response ──────────────────────────────────────────────────────
    return {
      meta: { days, since: since.toISOString(), tenantId: input.tenantId, userId: input.userId },
      summary: byAction.map((r: any) => ({
        action:  r.action,
        label:   ACTION_LABELS[r.action] ?? r.action,
        count:   r._count.action,
      })),
      timeline,
      topUsers,
      tenants,
      tenantUsers,
      recentEvents,
      actionLabels: ACTION_LABELS,
    };
  }
}
