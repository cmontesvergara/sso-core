import { AppSession, Session } from '../../../domain/entities/Session';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { IAuditService } from '../../ports/output/IAuditService';
import { IQueryRepository } from '../../ports/output/IQueryRepository';
import { ITokenService } from '../../ports/output/ITokenService';

export interface GetSessionContextInput {
  sessionId: string;
  appId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * GetSessionContextUseCase
 *
 * Handles POST /api/v2/auth/session.
 * The sessionId is the JTI set in the session cookie — it can be either:
 *   - A hex v3 session  (UUID format, stored in SSOSession / AppSession tables)
 *   - A v2 app session  (app_XXXXXXXX format, also stored in AppSession.sessionToken)
 *
 * Both are reachable via ISessionRepository (PrismaSessionRepository.findById looks up
 * by sessionToken in both tables). If the session is not found there, it is genuinely
 * expired or invalid.
 */
export class GetSessionContextUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private queryRepository: IQueryRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService
  ) { }

  async execute(input: GetSessionContextInput): Promise<any> {
    if (!input.sessionId) {
      // Return structured response instead of throwing — the caller turns exceptions into 500s
      return { success: false, valid: false, message: 'Session ID is required' };
    }

    // ── 1. Look up the session (hex repo covers both v3 UUID and v2 app_* tokens) ──
    const sessionId = SessionId.create(input.sessionId);
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      // Session truly not found (expired or never existed)
      await this.auditService.log({
        type: 'SESSION_CONTEXT_FAILURE',
        sessionId: input.sessionId,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { reason: 'Session not found or expired' },
      });
      return { success: false, valid: false, message: 'Session not found or expired' };
    }

    await this.auditService.log({
      type: 'SESSION_CONTEXT',
      userId: session.userId.value,
      tenantId: (session as any).tenantId?.value,
      sessionId: session.id.value,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    // ── 2. Enrich AppSession with Application metadata if not present ───────────
    // NOTE: We re-issue an access token from the stored session so the client always
    // has a valid Bearer token after calling /session.  The refresh token is NOT
    // rotated here — rotation only happens through the explicit /refresh endpoint.
    let enrichedSession: Session = session;
    if (enrichedSession instanceof AppSession && !enrichedSession.audience) {
      const appRecord = await this.queryRepository.findApplicationByAppId(enrichedSession.appId);
      if (appRecord) {
        enrichedSession = new AppSession(
          enrichedSession.id,
          enrichedSession.sessionToken,
          enrichedSession.userId,
          enrichedSession.tenantId,
          enrichedSession.appId,
          enrichedSession.role,
          enrichedSession.ip,
          enrichedSession.userAgent,
          enrichedSession.expiresAt,
          enrichedSession.createdAt,
          enrichedSession.lastActivityAt,
          enrichedSession.ssoSessionId,
          appRecord.audience ?? undefined,
          appRecord.url ?? undefined,
          appRecord.backendUrl ?? undefined
        );
      }
    }

    const tokens = await this.tokenService.generateTokens(enrichedSession);

    // ── 3. Load user via query repository ────────────────────────────────────────
    const user = await this.queryRepository.findUserById(session.userId.value);

    if (!user) {
      throw new Error('User not found');
    }

    // ── 4. Tenant memberships ─────────────────────────────────────────────────────
    const tenants = await this.queryRepository.findTenantMemberships(
      user.id,
      input.appId ?? undefined
    );

    // ── 5. Resolve current tenant ─────────────────────────────────────────────────
    const activeTenantId = (session as any).tenantId?.value;
    const currentTenant = tenants.find(t => t.id === activeTenantId) || tenants[0] || null;

    // ── 6. Resolve permissions for current tenant + app ───────────────────────────
    let permissions: Array<{ resource: string; action: string }> = [];

    if (currentTenant && input.appId) {
      permissions = await this.queryRepository.findRolePermissions(
        currentTenant.id,
        currentTenant.role,
        input.appId
      );
    }

    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        // refreshToken is intentionally omitted — it lives in the httpOnly cookie
        // and is only rotated via the explicit POST /refresh endpoint.
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
      },
      currentTenant: currentTenant ? { ...currentTenant, permissions } : null,
      relatedTenants: tenants,
    };
  }
}
