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
import { ILogger } from '../../ports/output/ILogger';
import { IQueryRepository } from '../../ports/output/IQueryRepository';
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
    private queryRepository: IQueryRepository,
    private logger: ILogger,
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
    this.logger.info('Refresh attempt', {
      userId: claims.sub,
      tenantId: resolvedTenantId,
      appId: resolvedAppId,
      tokenPrefix: input.refreshToken.substring(0, 20),
      computedHash: tokenHash,
    });
    const refreshToken = await this.refreshTokenRepository.findByHash(tokenHash);
    this.logger.info('Refresh token lookup result', { found: !!refreshToken, hash: tokenHash });

    if (!refreshToken) {
      // Token not found - reject (legacy V2 tokens no longer supported)
      this.logger.warn('Refresh token not found in DB', { userId: claims.sub, hash: tokenHash });
      await this.auditService.log({
        type: 'REFRESH_FAILURE',
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { reason: 'Token not found in refresh token table', userId: claims.sub, computedHash: tokenHash },
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
    const user = await this.queryRepository.findUserById(refreshToken.userId.value);

    // 5. Create new AppSession
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // tenantId chain: JWT claims -> input -> DB lookup -> userId last-resort
    // Prefer claims.tenantId over input.tenantId because the refresh token JWT
    // always contains the correct tenant context, whereas input.tenantId may be
    // empty if the client lost the access token before refreshing.
    let effectiveTenantId: string | undefined = claims.tenantId || resolvedInput.tenantId;
    if (!effectiveTenantId && user) {
      const firstMembership = await this.queryRepository.findFirstTenantMembership(
        user.id,
        resolvedInput.appId ?? undefined
      );
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
      tenants = await this.queryRepository.findTenantMemberships(
        user.id,
        input.appId ?? undefined
      );

      const activeTenantId = input.tenantId || session.tenantId.value;
      const currentTenantMember = tenants.find((t: any) => t.id === activeTenantId);

      if (currentTenantMember && input.appId) {
        permissions = await this.queryRepository.findRolePermissions(
          activeTenantId,
          currentTenantMember.role,
          input.appId
        );
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
      this.logger.warn('No matching tenant for refresh', { activeTenantId, available: tenants.map(t => t.id) });
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
