import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { PrismaClient } from '@prisma/client';
import { SessionId } from '../../../domain/value-objects/SessionId';

export interface GetSessionContextInput {
  sessionId: string;
  appId?: string;
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
    private prisma: PrismaClient,
    private tokenService: ITokenService
  ) {}

  async execute(input: GetSessionContextInput): Promise<any> {
    if (!input.sessionId) {
      throw new Error('SessionId cannot be empty');
    }

    // ── 1. Look up the session (hex repo covers both v3 UUID and v2 app_* tokens) ──
    const sessionId = SessionId.create(input.sessionId);
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      // Session truly not found (expired or never existed)
      return { success: false, valid: false, message: 'Session not found or expired' };
    }

    // ── 2. Generate a fresh access token ─────────────────────────────────────────
    const tokens = await this.tokenService.generateTokens(session);

    // ── 3. Load user from Prisma (already injected, no src/ needed) ──────────────
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId.value },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // ── 4. Tenant memberships ─────────────────────────────────────────────────────
    const tenantMembers = await this.prisma.tenantMember.findMany({
      where: {
        userId: user.id,
        tenant: input.appId
          ? {
              tenantApps: {
                some: {
                  application: { appId: input.appId },
                  isEnabled: true,
                },
              },
            }
          : undefined,
      },
      include: { tenant: true },
    });

    const tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      domain: tm.tenant.domain,
      slug: tm.tenant.slug,
      role: tm.role,
    }));

    // ── 5. Resolve current tenant ─────────────────────────────────────────────────
    const activeTenantId = (session as any).tenantId?.value;
    const currentTenant = tenants.find(t => t.id === activeTenantId) || tenants[0] || null;

    // ── 6. Resolve permissions for current tenant + app ───────────────────────────
    let permissions: Array<{ resource: string; action: string }> = [];

    if (currentTenant && input.appId) {
      const roleRecord = await this.prisma.role.findFirst({
        where: { tenantId: currentTenant.id, name: currentTenant.role },
      });
      if (roleRecord) {
        const application = await this.prisma.application.findUnique({
          where: { appId: input.appId },
        });
        if (application) {
          const rolePermissions = await this.prisma.permission.findMany({
            where: { roleId: roleRecord.id, applicationId: application.id },
            select: { resource: true, action: true },
          });
          permissions = rolePermissions.map((p: any) => ({
            resource: p.resource,
            action: p.action,
          }));
        }
      }
    }

    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        // Refresh token is managed via httpOnly cookie — not returned here
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
