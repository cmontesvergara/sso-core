import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { IHashService } from '../../ports/output/IHashService';
import { RefreshTokenInput } from '../../dto/input/RefreshTokenInput';
import { LoginResult } from '../../dto/output/LoginResult';
import { TokenRefreshedEvent } from '../../../domain/events/AuthEvents';
import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { AppSession } from '../../../domain/entities/Session';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { UserId } from '../../../domain/value-objects/UserId';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';

/**
 * RefreshTokenUseCase
 * Orchestrates token refresh with rotation.
 *
 * Two paths:
 * 1. Hex path  — token was created by hex ExchangeCodeUseCase and is stored in the
 *                hex RefreshToken table (findByHash). Full rotation.
 * 2. V2 path   — token is a raw JWT created by the legacy v2 exchange.  It was never
 *                stored in the hex table. We validate it via ITokenService, generate
 *                new tokens, and save a fresh AppSession — no rotation record needed.
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
    // 1. Validate JWT signature / expiry — also extracts tenantId/appId from token claims
    const claims = await this.tokenService.validateRefreshToken(input.refreshToken);
    if (!claims) {
      throw new InvalidCredentialsError('Invalid refresh token');
    }

    // Resolve tenantId — trust the JWT claims only, not client input
    // DB lookup as fallback for legacy tokens that don't have tenantId embedded
    const resolvedTenantId = claims.tenantId || null;
    const resolvedAppId    = claims.appId    || null;
    const resolvedInput    = { ...input, tenantId: resolvedTenantId ?? undefined, appId: resolvedAppId ?? undefined };

    // 2. Look up hex refresh token record
    const tokenHash = this.hashToken(input.refreshToken);
    const refreshToken = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!refreshToken) {
      // ── V2 fallback — JWT is valid but not in the hex table ──────────────────
      return this.handleV2Refresh(resolvedInput, claims);
    }

    // ── Hex path ──────────────────────────────────────────────────────────────

    // 3. Check token status
    if (!refreshToken.isActive()) {
      if (refreshToken.hasBeenRotated()) {
        await this.handleTokenReuse(refreshToken);
        throw new InvalidCredentialsError('Token reuse detected');
      }
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

    // tenantId chain: input → JWT claims → DB lookup → userId last-resort
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
    console.log('[RefreshTokenUseCase] tenantId:', effectiveTenantId, '(input:', input.tenantId, ', claims:', claims.tenantId, ')');

    const tenantId = effectiveTenantId
      ? TenantId.create(effectiveTenantId)
      : TenantId.create(refreshToken.userId.value); // last-resort

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

    // 6. Generate tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 7. Rotate refresh token
    const newTokenHash = this.hashToken(tokens.refreshToken);
    const newRefreshToken = refreshToken.createRotation(
      RefreshTokenId.create(crypto.randomUUID()),
      newTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    await this.refreshTokenRepository.update(refreshToken.revoke());
    await this.refreshTokenRepository.save(newRefreshToken);

    // 8. Events & audit
    await this.eventBus.publish(
      new TokenRefreshedEvent(refreshToken.userId, session.id, newTokenHash.substring(0, 16))
    );
    await this.auditService.log({
      type: 'TOKEN_REFRESH',
      userId: refreshToken.userId.value,
      sessionId: session.id.value,
    });

    // 9. Enrich response
    return this.buildResponse(tokens, user, session, resolvedInput);
  }

  // ── V2 path ───────────────────────────────────────────────────────────────────

  private async handleV2Refresh(input: RefreshTokenInput, claims: any): Promise<LoginResult> {
    const userId = claims.sub as string;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new InvalidCredentialsError('User not found');

    // Create a new AppSession for the v2 user
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // tenantId chain: JWT claims only → DB lookup → userId last-resort
    let effectiveTenantId: string | undefined = claims.tenantId;
    if (!effectiveTenantId) {
      const firstMembership = await this.prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          tenant: claims.appId
            ? { tenantApps: { some: { application: { appId: claims.appId }, isEnabled: true } } }
            : undefined,
        },
        select: { tenantId: true },
      });
      effectiveTenantId = firstMembership?.tenantId ?? undefined;
    }

    const tenantId = effectiveTenantId
      ? TenantId.create(effectiveTenantId)
      : TenantId.create(userId); // last-resort

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      UserId.create(userId),
      tenantId,
      claims.appId || 'default',
      user.systemRole || 'user',
      null,
      null,
      expiresAt,
      now,
      now
    );
    await this.sessionRepository.save(session);

    const tokens = await this.tokenService.generateTokens(session);

    await this.auditService.log({
      type: 'TOKEN_REFRESH_V2',
      userId,
      sessionId: session.id.value,
    });

    return this.buildResponse(tokens, user, session, input);
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

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

    // Safe tenant lookup — fallback to first available to avoid undefined spread
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

  private hashToken(token: string): string {
    return this.hashService.hash(token);
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
