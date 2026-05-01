import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { UserId } from '../../../domain/value-objects/UserId';
import { SessionRevokedEvent } from '../../../domain/events/AuthEvents';
import { SessionNotFoundError } from '../../../domain/errors/SessionNotFoundError';

export interface RevokeSessionInput {
  sessionId: string;
  userId: string;
  reason?: string;
}

export interface RevokeAllInput {
  userId: string;
  reason?: string;
}

/**
 * RevokeSessionUseCase
 * Revokes a single session and its associated refresh tokens.
 */
export class RevokeSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const sessionId = SessionId.create(input.sessionId);
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    // Delete session and associated refresh tokens
    await this.sessionRepository.delete(sessionId);
    await this.refreshTokenRepository.deleteAllForSession(sessionId);

    await this.eventBus.publish(
      new SessionRevokedEvent(session.userId, session.id, input.reason ?? 'Manual revocation')
    );

    await this.auditService.log({
      type: 'SESSION_REVOKED',
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: { reason: input.reason },
    });
  }
}

/**
 * RevokeAllUserSessionsUseCase
 * Global logout — revokes all sessions and refresh tokens for a user.
 */
export class RevokeAllUserSessionsUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: RevokeAllInput): Promise<{ revoked: number }> {
    const userId = UserId.create(input.userId);

    const [sessions, tokens] = await Promise.all([
      this.sessionRepository.deleteAllForUser(userId),
      this.refreshTokenRepository.deleteAllForUser(userId),
    ]);

    await this.auditService.log({
      type: 'ALL_SESSIONS_REVOKED',
      userId: input.userId,
      metadata: { sessionsDeleted: sessions, tokensDeleted: tokens, reason: input.reason },
    });

    return { revoked: sessions };
  }
}
