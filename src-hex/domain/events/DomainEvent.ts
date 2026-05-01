/**
 * DomainEvent
 * Base class for all domain events
 * Immutable
 */
export abstract class DomainEvent {
  readonly occurredAt: Date;
  readonly eventId: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    // Note: Object.freeze is NOT called here so subclasses can assign their own
    // readonly fields before the object is sealed.
  }

  abstract get eventType(): string;
}

/**
 * DomainEventHandler
 * Interface for handling domain events
 */
export interface DomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}
