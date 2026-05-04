import crypto from 'crypto';
import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { AppSession } from '../../../domain/entities/Session';
import { IAuthCodeRepository } from '../../../domain/repositories/IAuthCodeRepository';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { IHashService } from '../../ports/output/IHashService';
import { ITokenService } from '../../ports/output/ITokenService';

import { PrismaClient } from '@prisma/client';
import { InvalidAuthCodeError } from '../../../domain/errors/InvalidAuthCodeError';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { LoginResult } from '../../dto/output/LoginResult';

export interface ExchangeCodeInput {
  code: string;
  codeVerifier?: string;
  appId: string;
}

/**
 * ExchangeCodeUseCase
 * Exchanges a PKCE authorization code for access + refresh tokens.
 * Implements the OAuth 2.0 Authorization Code flow (PKCE).
 */
export class ExchangeCodeUseCase {
  constructor(
    private authCodeRepository: IAuthCodeRepository,
    private sessionRepository: ISessionRepository,
    private userRepository: IUserRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService,
    private prisma: PrismaClient,
  ) { }

  async execute(input: ExchangeCodeInput): Promise<LoginResult> {
    // 1. Find auth code
    const authCode = await this.authCodeRepository.findByCode(input.code);
    if (!authCode) {
      throw new InvalidAuthCodeError('Auth code not found');
    }

    // 2. Validate code is usable
    if (!authCode.isUsable()) {
      throw new InvalidAuthCodeError('Auth code has expired or already been used');
    }



    // 4. Verify PKCE verifier
    if (input.codeVerifier !== undefined && !authCode.verifyVerifier(input.codeVerifier)) {
      throw new InvalidAuthCodeError('PKCE code verifier does not match');
    }

    // 5. Confirm user exists
    const user = await this.userRepository.findById(authCode.userId);
    if (!user) {
      throw new UserNotFoundError(authCode.userId.value);
    }

    // 6. Mark code as used
    const usedCode = authCode.markAsUsed();
    await this.authCodeRepository.update(usedCode);

    // 7. Create app session
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      authCode.userId,
      authCode.tenantId,
      input.appId,
      user.systemRole,
      null,
      null,
      expiresAt,
      now,
      now,
      authCode.ssoSessionId ?? undefined
    );
    await this.sessionRepository.save(session);

    // 8. Generate and save tokens
    const tokens = await this.tokenService.generateTokens(session);

    const tokenHash = this.hashService.hash(tokens.refreshToken);
    const refreshTokenEntity = new RefreshToken(
      RefreshTokenId.create(crypto.randomUUID()),
      authCode.userId,
      tokenHash,
      now,
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    );
    await this.refreshTokenRepository.save(refreshTokenEntity);

    // 9. Fetch enrichment data (tenant memberships + permissions)
    const prisma = this.prisma;

    // Fetch tenant memberships with tenant details
    const tenantMembers = await prisma.tenantMember.findMany({
      where: {
        userId: authCode.userId.value,
        tenant: {
          tenantApps: {
            some: {
              application: { appId: input.appId },
              isEnabled: true,
            },
          },
        },
      },
      include: { tenant: true },
    });

    const tenants = tenantMembers.map((tm: any) => ({
      id: tm.tenant.id,
      name: tm.tenant.name,
      slug: tm.tenant.slug,
      role: tm.role,
    }));

    // Generate permissions for the current tenant
    let permissions: Array<{ resource: string; action: string }> = [];
    const currentTenantMember = tenantMembers.find((tm: any) => tm.tenantId === authCode.tenantId.value);

    if (currentTenantMember) {
      const roleRecord = await prisma.role.findFirst({
        where: {
          tenantId: authCode.tenantId.value,
          name: currentTenantMember.role,
        },
      });

      if (roleRecord) {
        const application = await prisma.application.findUnique({
          where: { appId: input.appId },
        });

        if (application) {
          const rolePermissions = await prisma.permission.findMany({
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

    // 10. Audit
    await this.auditService.log({
      type: 'CODE_EXCHANGED',
      userId: authCode.userId.value,
      sessionId: sessionToken,
      metadata: { appId: input.appId },
    });

    // Format User Result
    const userInformation = {
      id: user.id.value,
      email: user.email.value,
      nuid: user.nuid.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      userStatus: user.userStatus,
      systemRole: user.systemRole,
    };

    return {
      success: true,
      tokens: {
        jti: sessionToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: userInformation,
      currentTenant: {
        ...tenants.find((t: any) => t.id === authCode.tenantId.value),
        permissions,
      },
      relatedTenants: tenants,
      expiresIn: tokens.expiresIn, // keeping flat for safety
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
