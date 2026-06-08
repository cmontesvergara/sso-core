import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { AppSession } from '../../../domain/entities/Session';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';
import { TokenRefreshedEvent } from '../../../domain/events/AuthEvents';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RefreshTokenInput } from '../../dto/input/RefreshTokenInput';
import { LoginResult } from '../../dto/output/LoginResult';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { IHashService } from '../../ports/output/IHashService';
import { ITokenService } from '../../ports/output/ITokenService';

/**
 * RefreshTokenUseCase
 * Orchestrates token refresh with rotation.
 *
 * All refresh tokens must exist in the hexagonal RefreshToken table.
 * Tokens not found are rejected with InvalidCredentialsError.
 */
export class RefreshTokenUseCase {
  constructor(
    private refreshTokenRepository: IRefreshTokenRepository,
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService,
    private prisma: PrismaClient,
  ) { }

  async execute(input: RefreshTokenInput): Promise<LoginResult> {
    // 1. Validate JWT signature / expiry
    const claims = await this.tokenService.validateRefreshToken(input.refreshToken);
    if (!claims) {
      await this.auditService.log({
        type: 'REFRESH_FAILURE',
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { reason: 'Invalid refresh token signature or expiry' },
      });
      throw new InvalidCredentialsError('Invalid refresh token');
    }

    const resolvedTenantId = claims.tenantId || null;
    const resolvedAppId = claims.appId || null;
    const resolvedInput = { ...input, tenantId: resolvedTenantId ?? undefined, appId: resolvedAppId ?? undefined };

    // 2. Look up refresh token record
    const tokenHash = this.hashService.hash(input.refreshToken);
    const refreshToken = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!refreshToken) {
      // Token not found - reject (legacy V2 tokens no longer supported)
      await this.auditService.log({
        type: 'REFRESH_FAILURE',
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { reason: 'Token not found in refresh token table', userId: claims.sub },
      });
      throw new InvalidCredentialsError('Token not recognized. Please login again.');
    }

    // 3. Check token status
    if (!refreshToken.isActive()) {
      if (refreshToken.hasBeenRotated()) {
        await this.handleTokenReuse(refreshToken);
        throw new InvalidCredentialsError('Token reuse detected');
      }
      await this.auditService.log({
        type: 'REFRESH_FAILURE',
        userId: refreshToken.userId.value,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { reason: 'Token has been revoked' },
      });
      throw new InvalidCredentialsError('Token has been revoked');
    }

    // 4. Load user
    const user = await this.prisma.user.findUnique({
      where: { id: refreshToken.userId.value },
    });

    // 5. Create new AppSession
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // tenantId chain: input -> JWT claims -> DB lookup -> userId last-resort
    let effectiveTenantId: string | undefined = resolvedInput.tenantId || claims.tenantId;
    if (!effectiveTenantId && user) {
      const firstMembership = await this.prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          tenant: resolvedInput.appId
            ? { tenantApps: { some: { application: { appId: resolvedInput.appId }, isEnabled: true } } }
            : undefined,
        },
        select: { tenantId: true },
      });
      effectiveTenantId = firstMembership?.tenantId ?? undefined;
    }

    const tenantId = effectiveTenantId
      ? TenantId.create(effectiveTenantId)
      : TenantId.create(refreshToken.userId.value);

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      refreshToken.userId,
      tenantId,
      resolvedInput.appId || 'default',
      user?.systemRole || 'user',
      null,
      null,
      expiresAt,
      now,
      now
    );
    await this.sessionRepository.save(session);

    // 6. Rotate refresh token
    const newRefreshToken = refreshToken.createRotation(
      RefreshTokenId.create(crypto.randomUUID()),
      this.hashService.hash(sessionToken),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    await this.refreshTokenRepository.save(newRefreshToken);
    await this.refreshTokenRepository.update(refreshToken.revoke());

    // 7. Generate tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 8. Publish event - TokenRefreshedEvent takes (userId, sessionId, tokenFamily)
    await this.eventBus.publish(
      new TokenRefreshedEvent(
        refreshToken.userId,
        session.id,
        newRefreshToken.id.value
      )
    );

    // 9. Log audit
    await this.auditService.log({
      type: 'TOKEN_REFRESH',
      userId: refreshToken.userId.value,
      tenantId: effectiveTenantId || undefined,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return this.buildResponse(tokens, user, session, input);
  }

  private async buildResponse(tokens: any, user: any, session: AppSession, input: RefreshTokenInput): Promise<LoginResult> {
    let tenants: any[] = [];
    let permissions: Array<{ resource: string; action: string }> = [];

    if (user) {
      const tenantMembers = await this.prisma.tenantMember.findMany({
        where: {
          userId: user.id,
          tenant: input.appId
            ? { tenantApps: { some: { application: { appId: input.appId }, isEnabled: true } } }
            : undefined,
        },
        include: { tenant: true },
      });

      tenants = tenantMembers.map((tm: any) => ({
        id: tm.tenant.id,
        name: tm.tenant.name,
        slug: tm.tenant.slug,
        role: tm.role,
      }));

      const activeTenantId = input.tenantId || session.tenantId.value;
      const currentTenantMember = tenantMembers.find((tm: any) => tm.tenantId === activeTenantId);

      if (currentTenantMember && input.appId) {
        const roleRecord = await this.prisma.role.findFirst({
          where: { tenantId: activeTenantId, name: currentTenantMember.role },
        });
        if (roleRecord) {
          const application = await this.prisma.application.findUnique({ where: { appId: input.appId } });
          if (application) {
            const rolePermissions = await this.prisma.permission.findMany({
              where: { roleId: roleRecord.id, applicationId: application.id },
              select: { resource: true, action: true },
            });
            permissions = rolePermissions.map((p: any) => ({ resource: p.resource, action: p.action }));
          }
        }
      }
    }

    const userInformation = user ? {
      id: user.id,
      email: user.email,
      nuid: user.nuid,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      userStatus: user.userStatus,
      systemRole: user.systemRole,
    } : null;

    const activeTenantId = input.tenantId || session.tenantId.value;
    const matchedTenant = tenants.find((t: any) => t.id === activeTenantId) ?? tenants[0] ?? null;

    if (!matchedTenant) {
      console.warn('[RefreshTokenUseCase] No matching tenant for id:', activeTenantId, '| available:', tenants.map(t => t.id));
    }

    return {
      success: true,
      tokens: {
        jti: session.sessionToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: userInformation,
      currentTenant: {
        ...(matchedTenant ?? {}),
        permissions,
      },
      relatedTenants: tenants,
      expiresIn: tokens.expiresIn,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async handleTokenReuse(token: RefreshToken): Promise<void> {
    const userTokens = await this.refreshTokenRepository.findByUser(token.userId);
    for (const userToken of userTokens) {
      if (userToken.isActive()) {
        await this.refreshTokenRepository.update(userToken.revoke());
      }
    }
    await this.auditService.logSecurity({
      type: 'TOKEN_REUSE_DETECTED',
      userId: token.userId.value,
      metadata: { tokenId: token.id.value },
    });
  }
}
