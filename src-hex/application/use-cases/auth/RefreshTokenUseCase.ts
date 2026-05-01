import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { IHashService } from '../../ports/output/IHashService';
import { RefreshTokenInput } from '../../dto/input/RefreshTokenInput';
import { TokenResult } from '../../dto/output/TokenResult';
import { TokenRefreshedEvent } from '../../../domain/events/AuthEvents';
import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { AppSession } from '../../../domain/entities/Session';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';

/**
 * RefreshTokenUseCase
 * Orchestrates token refresh with rotation
 * Updated for aligned domain entities
 */
export class RefreshTokenUseCase {
  constructor(
    private refreshTokenRepository: IRefreshTokenRepository,
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService
  ) { }

  async execute(input: RefreshTokenInput): Promise<TokenResult> {
    // 1. Validate refresh token
    const claims = await this.tokenService.validateRefreshToken(input.refreshToken);
    if (!claims) {
      throw new InvalidCredentialsError('Invalid refresh token');
    }

    // 2. Find token in repository
    const tokenHash = this.hashToken(input.refreshToken);
    const refreshToken = await this.refreshTokenRepository.findByHash(tokenHash);
    if (!refreshToken) {
      throw new InvalidCredentialsError('Refresh token not found');
    }

    // 3. Check if token is active
    if (!refreshToken.isActive()) {
      // Potential token reuse detected
      if (refreshToken.hasBeenRotated()) {
        await this.handleTokenReuse(refreshToken);
        throw new InvalidCredentialsError('Token reuse detected');
      }
      throw new InvalidCredentialsError('Token has been revoked');
    }

    // 4. Create new app session
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const tenantId = input.tenantId
      ? TenantId.create(input.tenantId)
      : TenantId.create(refreshToken.userId.value); // Fallback

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      refreshToken.userId,
      tenantId,
      input.appId || 'default',
      'user', // Default role
      null, // ip
      null, // userAgent
      expiresAt,
      now,
      now
    );
    await this.sessionRepository.save(session);

    // 5. Generate new tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 6. Create new refresh token (rotation)
    const newTokenHash = this.hashToken(tokens.refreshToken);
    const newRefreshToken = refreshToken.createRotation(
      RefreshTokenId.create(`rt_${Date.now()}`),
      newTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    );

    // 7. Revoke old token and save new one
    await this.refreshTokenRepository.update(refreshToken.revoke());
    await this.refreshTokenRepository.save(newRefreshToken);

    // 8. Publish event
    await this.eventBus.publish(
      new TokenRefreshedEvent(
        refreshToken.userId,
        session.id,
        newTokenHash.substring(0, 16) // Use hash prefix as family identifier
      )
    );

    // 9. Log audit
    await this.auditService.log({
      type: 'TOKEN_REFRESH',
      userId: refreshToken.userId.value,
      sessionId: session.id.value,
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  private hashToken(token: string): string {
    return this.hashService.hash(token);
  }

  private async handleTokenReuse(token: RefreshToken): Promise<void> {
    // Find all tokens for this user and revoke them
    const userTokens = await this.refreshTokenRepository.findByUser(token.userId);
    for (const userToken of userTokens) {
      if (userToken.isActive()) {
        await this.refreshTokenRepository.update(userToken.revoke());
      }
    }

    await this.auditService.logSecurity({
      type: 'TOKEN_REUSE_DETECTED',
      userId: token.userId.value,
      metadata: {
        tokenId: token.id.value,
      },
    });
  }
}
