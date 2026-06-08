import { AuthEventSummaryInput, IAuthEventsQueryService } from '../../ports/output/IAuthEventsQueryService';
import { IUserQueryService } from '../../ports/output/IUserQueryService';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  AUTH_SUCCESS: 'Autenticación exitosa',
  TOKEN_REFRESH: 'Refresh de token',
  SESSION_CONTEXT: 'Consulta de sesión',
  LOGOUT: 'Cierre de sesión',
  AUTH_FAILURE: 'Fallo de autenticación',
  REFRESH_FAILURE: 'Fallo de refresh',
  SESSION_CONTEXT_FAILURE: 'Fallo de consulta de sesión',
  SESSION_EXPIRED: 'Sesión expirada',
  SECURITY_TOKEN_REUSE_DETECTED: 'Reutilización de token',
  RATE_LIMIT_BLOCKED: 'Bloqueado por Rate Limit',
};

/**
 * AuthEventsUseCases
 *
 * Produces structured event data for the SSO Manager activity dashboard.
 * Uses IAuthEventsQueryService for data access and handles response formatting.
 */
export class AuthEventsUseCases {
  constructor(
    private readonly authEventsQueryService: IAuthEventsQueryService,
    private readonly userQueryService: IUserQueryService,
  ) { }

  async getAuthEventSummary(input: AuthEventSummaryInput) {
    const days = input.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const raw = await this.authEventsQueryService.getAuthEventSummary(input);

    // Enrich recent logs with user emails
    const logUserIds = [...new Set(raw.recentLogs.map((l: any) => l.userId).filter(Boolean))] as string[];
    const logUsers = logUserIds.length > 0
      ? await this.userQueryService.listUsers({ limit: logUserIds.length, search: '' }).then(r => r.users)
      : [];

    const recentEvents = raw.recentLogs.map((log: any) => {
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

    return {
      meta: { days, since: since.toISOString(), tenantId: input.tenantId, userId: input.userId },
      summary: raw.byAction.map((r: any) => ({
        action: r.action,
        label: ACTION_LABELS[r.action] ?? r.action,
        count: r.count,
      })),
      timeline: raw.timeline,
      topUsers: raw.topUsers,
      tenants: raw.tenants,
      tenantUsers: raw.tenantUsers,
      recentEvents,
      actionLabels: ACTION_LABELS,
    };
  }
}
