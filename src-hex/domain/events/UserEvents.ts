import { DomainEvent } from './DomainEvent';
import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';

/**
 * UserCreatedEvent
 * Emitted when a new user is registered
 */
export class UserCreatedEvent extends DomainEvent {
  readonly eventType = 'UserCreated';

  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly firstName: string,
    public readonly lastName: string
  ) {
    super();
  }
}

/**
 * PasswordChangedEvent
 * Emitted when a user changes their password
 */
export class PasswordChangedEvent extends DomainEvent {
  readonly eventType = 'PasswordChanged';

  constructor(
    public readonly userId: UserId,
    public readonly changedAt: Date = new Date()
  ) {
    super();
  }
}

/**
 * UserProfileUpdatedEvent
 * Emitted when a user's profile is updated
 */
export class UserProfileUpdatedEvent extends DomainEvent {
  readonly eventType = 'UserProfileUpdated';

  constructor(
    public readonly userId: UserId,
    public readonly changes: Record<string, any>
  ) {
    super();
  }
}

/**
 * UserDeactivatedEvent
 * Emitted when a user account is deactivated
 */
export class UserDeactivatedEvent extends DomainEvent {
  readonly eventType = 'UserDeactivated';

  constructor(
    public readonly userId: UserId,
    public readonly reason?: string
  ) {
    super();
  }
}
