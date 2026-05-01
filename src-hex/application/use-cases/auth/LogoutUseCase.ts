import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { LogoutInput } from '../../dto/input/LogoutInput';
import { UserLoggedOutEvent } from '../../../domain/events/AuthEvents';
import { SessionRevokedEvent } from '../../../domain/events/AuthEvents';
import { SessionNotFoundError } from '../../../domain/errors/SessionNotFoundError';

/**
 * LogoutUseCase
 * Orchestrates the logout process
 */
export class LogoutUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) { }

  async execute(input: LogoutInput): Promise<void> {
    // 1. Find session
    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError(input.sessionId.value);
    }

    // 2. Delete session (Prisma doesn't have isRevoked field, we delete instead)
    await this.sessionRepository.delete(input.sessionId);

    // 3. Publish events
    await this.eventBus.publish(new UserLoggedOutEvent(session.userId, session.id, input.isGlobal));

    await this.eventBus.publish(
      new SessionRevokedEvent(
        session.userId,
        session.id,
        input.isGlobal ? 'Global logout' : 'User logout'
      )
    );

    // 4. Log audit
    await this.auditService.log({
      type: 'LOGOUT',
      userId: input.userId,
      sessionId: input.sessionId.value,
      metadata: {
        isGlobal: input.isGlobal,
      },
    });

    // 5. If global logout, delete all user sessions
    if (input.isGlobal) {
      await this.sessionRepository.deleteAllForUser(session.userId);
    }
  }
}
