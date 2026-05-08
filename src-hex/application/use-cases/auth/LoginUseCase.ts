import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import crypto from 'crypto';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { IHashService } from '../../ports/output/IHashService';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { LoginInput } from '../../dto/input/LoginInput';
import { LoginResult } from '../../dto/output/LoginResult';
import { UserLoggedInEvent } from '../../../domain/events/AuthEvents';
import { User } from '../../../domain/entities/User';
import { SSOSession } from '../../../domain/entities/Session';
import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { DeviceFingerprint } from '../../../domain/value-objects/DeviceFingerprint';
import { Email } from '../../../domain/value-objects/Email';
import { NUID } from '../../../domain/value-objects/NUID';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import {
  AuthenticationService,
  IPasswordHasher,
} from '../../../domain/services/AuthenticationService';

/**
 * LoginUseCase
 * Orchestrates the login process
 */
export class LoginUseCase {
  private authService: AuthenticationService;

  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService,
    passwordHasher: IPasswordHasher
  ) {
    this.authService = new AuthenticationService(passwordHasher);
  }

  async execute(input: LoginInput): Promise<LoginResult> {
    // 1. Find user
    const user = await this.findUser(input.email, input.nuid);
    if (!user) {
      await this.auditService.logAuthFailure(
        input.email || input.nuid || 'unknown',
        input.deviceFingerprint?.ip || 'unknown',
        'User not found'
      );
      throw new UserNotFoundError(input.email || input.nuid || 'unknown');
    }

    // 2. Verify credentials
    await this.authService.verifyCredentials(user, input.password);

    // 3. Check tenant access (if tenant specified)
    if (input.tenantId) {
      const tenantId = TenantId.create(input.tenantId);
      this.authService.ensureTenantAccess(user, tenantId);
    }

    // 4. Create SSO session
    const session = await this.createSession(user, input);

    // 5. Generate and save tokens
    const tokens = await this.tokenService.generateTokens(session);
    
    const tokenHash = this.hashService.hash(tokens.refreshToken);
    const refreshTokenEntity = new RefreshToken(
      RefreshTokenId.create(crypto.randomUUID()),
      user.id,
      tokenHash,
      new Date(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    );
    await this.refreshTokenRepository.save(refreshTokenEntity);

    // 6. Publish event
    const eventTenantId = input.tenantId
      ? TenantId.create(input.tenantId)
      : TenantId.create(user.id.value); // Use user ID as default tenant for SSO

    await this.eventBus.publish(
      new UserLoggedInEvent(
        user.id,
        eventTenantId,
        session.id,
        input.deviceFingerprint || DeviceFingerprint.create({}),
        input.deviceFingerprint?.ip || 'unknown'
      )
    );

    // 7. Log audit
    await this.auditService.logAuthSuccess(
      user.id.value,
      input.deviceFingerprint?.ip || 'unknown',
      input.deviceFingerprint?.userAgent || 'unknown'
    );

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  private async findUser(email?: string, nuid?: string): Promise<User | null> {
    if (email) {
      const emailResult = Email.create(email);
      if (emailResult.isSuccess) {
        return this.userRepository.findByEmail(emailResult.value);
      }
    }
    if (nuid) {
      return this.userRepository.findByNUID(NUID.create(nuid));
    }
    return null;
  }

  private async createSession(user: User, input: LoginInput): Promise<SSOSession> {
    const sessionToken = `sso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const deviceFingerprint = input.deviceFingerprint || DeviceFingerprint.create({});
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const session = new SSOSession(
      SessionId.create(sessionToken),
      sessionToken,
      user.id,
      deviceFingerprint.ip || null,
      deviceFingerprint.userAgent || null,
      expiresAt,
      now,
      now
    );

    await this.sessionRepository.save(session);
    return session;
  }
}
