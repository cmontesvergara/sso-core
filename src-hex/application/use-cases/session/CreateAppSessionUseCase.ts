import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { CreateSessionInput } from '../../dto/input/CreateSessionInput';
import { SessionResult } from '../../dto/output/SessionResult';
import { AppSession } from '../../../domain/entities/Session';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { DeviceFingerprint } from '../../../domain/value-objects/DeviceFingerprint';
import { UserLoggedInEvent } from '../../../domain/events/AuthEvents';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { TenantAccessDeniedError } from '../../../domain/errors/TenantAccessDeniedError';

/**
 * CreateAppSessionUseCase
 * Creates an application session after successful authorization
 */
export class CreateAppSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private userRepository: IUserRepository,
    private tenantRepository: ITenantRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) { }

  async execute(input: CreateSessionInput): Promise<SessionResult> {
    // 1. Validate user exists
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 2. Validate tenant access
    const tenantId = input.tenantId ? TenantId.create(input.tenantId) : null;
    if (tenantId && !user.canAccessTenant(tenantId)) {
      throw new TenantAccessDeniedError(user.id.value, tenantId.value);
    }

    // 3. Create app session
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + (input.expiresInSeconds || 15 * 60) * 1000);
    const deviceFingerprint = input.deviceFingerprint || DeviceFingerprint.create({});

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      user.id,
      tenantId!,
      input.appId,
      'user', // Default role
      deviceFingerprint.ip || null,
      deviceFingerprint.userAgent || null,
      expiresAt,
      now,
      now
    );

    await this.sessionRepository.save(session);

    // 4. Generate tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 5. Publish event
    await this.eventBus.publish(
      new UserLoggedInEvent(
        user.id,
        tenantId || (user.id as unknown as TenantId),
        session.id,
        input.deviceFingerprint || DeviceFingerprint.create({}),
        input.deviceFingerprint?.ip || 'unknown'
      )
    );

    // 6. Log audit
    await this.auditService.log({
      type: 'APP_SESSION_CREATED',
      userId: user.id.value,
      tenantId: tenantId?.value,
      sessionId: session.id.value,
    });

    return {
      sessionId: session.id.value,
      userId: user.id.value,
      tenantId: tenantId?.value,
      appId: input.appId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}
