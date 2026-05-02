import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { PrismaClient } from '@prisma/client';
import { SessionId } from '../../../domain/value-objects/SessionId';

export interface GetSessionContextInput {
  sessionId: string;
  appId?: string;
}

export class GetSessionContextUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private prisma: PrismaClient,
    private tokenService: ITokenService
  ) {}

  async execute(input: GetSessionContextInput): Promise<any> {
    const sessionId = SessionId.create(input.sessionId);
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Since we don't have a direct method to get raw tokens from just a session id in Hexagonal architecture,
    // and the SSO Client only needs the metadata (user, tenants, etc.), we don't need to return the tokens here,
    // OR we could generate a new access token without rotating the refresh token.
    // For now, let's generate a new token pair just like the legacy /session did (it returned cached tokens, but generating a new one is fine).
    const tokens = await this.tokenService.generateTokens(session);

    // Fetch user and permissions
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId.value },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let tenants: any[] = [];
    let permissions: Array<{ resource: string; action: string }> = [];

    // Fetch tenant memberships
    const tenantMembers = await this.prisma.tenantMember.findMany({
      where: {
        userId: user.id,
        tenant: input.appId ? {
          tenantApps: {
            some: {
              application: { appId: input.appId },
              isEnabled: true,
            },
          },
        } : undefined,
      },
      include: { tenant: true },
    });

    tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      domain: tm.tenant.domain,
      role: tm.role,
    }));

    // Find current tenant
    const activeTenantId = (session as any).tenantId?.value;
    const currentTenant = tenants.find(t => t.id === activeTenantId) || tenants[0] || null;

    if (currentTenant && input.appId) {
      const roleRecord = await this.prisma.role.findFirst({
        where: {
          tenantId: currentTenant.id,
          name: currentTenant.role,
        },
      });
      
      if (roleRecord) {
        const application = await this.prisma.application.findUnique({
          where: { appId: input.appId },
        });
        
        if (application) {
          const rolePermissions = await this.prisma.permission.findMany({
            where: {
              roleId: roleRecord.id,
              applicationId: application.id,
            },
            select: { resource: true, action: true },
          });
          permissions = rolePermissions.map((p: any) => ({ resource: p.resource, action: p.action }));
        }
      }
    }

    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        // Refresh token is handled by the browser cookie or other flow, we don't return it here to avoid overwriting.
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
      },
      currentTenant: currentTenant ? {
        ...currentTenant,
        permissions,
      } : null,
      relatedTenants: tenants,
    };
  }
}
