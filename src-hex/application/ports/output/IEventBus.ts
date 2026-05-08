import { DomainEvent } from '../../../domain/events/DomainEvent';

/**
 * IEventBus
 * Port for publishing and subscribing to domain events
 * Implemented in infrastructure layer
 */
export interface IEventBus {
  /**
   * Publish an event
   */
  publish<T extends DomainEvent>(event: T): Promise<void>;

  /**
   * Subscribe to an event type
   */
  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;

  /**
   * Publish multiple events
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}
