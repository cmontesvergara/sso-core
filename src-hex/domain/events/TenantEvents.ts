import { DomainEvent } from './DomainEvent';
import { TenantId } from '../value-objects/TenantId';
import { UserId } from '../value-objects/UserId';

/**
 * TenantCreatedEvent
 * Emitted when a new tenant is created
 */
export class TenantCreatedEvent extends DomainEvent {
  readonly eventType = 'TenantCreated';

  constructor(
    public readonly tenantId: TenantId,
    public readonly tenantName: string,
    public readonly createdBy: UserId
  ) {
    super();
  }
}

/**
 * UserAddedToTenantEvent
 * Emitted when a user is added to a tenant
 */
export class UserAddedToTenantEvent extends DomainEvent {
  readonly eventType = 'UserAddedToTenant';

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly role: string
  ) {
    super();
  }
}

/**
 * UserRemovedFromTenantEvent
 * Emitted when a user is removed from a tenant
 */
export class UserRemovedFromTenantEvent extends DomainEvent {
  readonly eventType = 'UserRemovedFromTenant';

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId
  ) {
    super();
  }
}

/**
 * UserRoleChangedEvent
 * Emitted when a user's role changes in a tenant
 */
export class UserRoleChangedEvent extends DomainEvent {
  readonly eventType = 'UserRoleChanged';

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly oldRole: string,
    public readonly newRole: string
  ) {
    super();
  }
}
