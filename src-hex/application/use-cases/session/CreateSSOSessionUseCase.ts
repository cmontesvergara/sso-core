import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { UserId } from '../../../domain/value-objects/UserId';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { SSOSession } from '../../../domain/entities/Session';
import { LoginResult } from '../../dto/output/LoginResult';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';

export interface CreateSSOSessionInput {
  userId: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: { ip?: string; userAgent?: string };
}

/**
 * CreateSSOSessionUseCase
 * Creates a new SSO (identity-level) session for an already-authenticated user.
 * Returns access + refresh tokens.
 */
export class CreateSSOSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private userRepository: IUserRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private _eventBus: IEventBus
  ) {}

  async execute(input: CreateSSOSessionInput): Promise<LoginResult> {
    // 1. Confirm user exists
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 2. Create SSO session
    const sessionToken = `sso_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

    const session = new SSOSession(
      SessionId.create(sessionToken),
      sessionToken,
      user.id,
      input.ip ?? input.deviceFingerprint?.ip ?? null,
      input.userAgent ?? input.deviceFingerprint?.userAgent ?? null,
      expiresAt,
      now,
      now
    );
    await this.sessionRepository.save(session);

    // 3. Generate tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 4. Audit
    await this.auditService.log({
      type: 'SSO_SESSION_CREATED',
      userId: user.id.value,
      sessionId: sessionToken,
      ip: input.ip,
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }
}
