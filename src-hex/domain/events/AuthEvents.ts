import { DomainEvent } from './DomainEvent';
import { UserId } from '../value-objects/UserId';
import { TenantId } from '../value-objects/TenantId';
import { DeviceFingerprint } from '../value-objects/DeviceFingerprint';
import { SessionId } from '../value-objects/SessionId';

/**
 * UserLoggedInEvent
 * Emitted when a user successfully logs in
 */
export class UserLoggedInEvent extends DomainEvent {
  readonly eventType = 'UserLoggedIn';

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly sessionId: SessionId,
    public readonly deviceFingerprint: DeviceFingerprint,
    public readonly ip: string
  ) {
    super();
  }
}

/**
 * UserLoggedOutEvent
 * Emitted when a user logs out
 */
export class UserLoggedOutEvent extends DomainEvent {
  readonly eventType = 'UserLoggedOut';

  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly isGlobal: boolean = false
  ) {
    super();
  }
}

/**
 * SessionRevokedEvent
 * Emitted when a session is revoked
 */
export class SessionRevokedEvent extends DomainEvent {
  readonly eventType = 'SessionRevoked';

  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly reason: string
  ) {
    super();
  }
}

/**
 * TokenRefreshedEvent
 * Emitted when a token is refreshed
 */
export class TokenRefreshedEvent extends DomainEvent {
  readonly eventType = 'TokenRefreshed';

  constructor(
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly tokenFamily: string
  ) {
    super();
  }
}
