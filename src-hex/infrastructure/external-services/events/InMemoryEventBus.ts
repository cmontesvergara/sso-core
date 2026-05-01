import { DomainEvent } from '../../../domain/events/DomainEvent';
import { IEventBus } from '../../../application/ports/output/IEventBus';

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * InMemoryEventBus
 * Implementation of IEventBus that runs handlers in the same Node.js process.
 * Handlers are registered at bootstrap time via subscribe().
 * This is the simplest possible event bus — no external broker required.
 * Swap it for RedisPubSubEventBus or KafkaEventBus in production if you need
 * cross-process delivery or durability guarantees.
 */
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, EventHandler[]>();

  /**
   * Subscribe to an event type.
   * Call at application startup (in Container or Bootstrap).
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler as EventHandler]);
  }

  /**
   * Publish a single domain event.
   * All registered handlers for this event type are executed sequentially.
   * Errors in individual handlers are caught and logged so one bad handler
   * does not prevent the others from running.
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventType) ?? [];
    for (const handler of eventHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(
          `[EventBus] Handler error for event "${event.eventType}":`,
          err
        );
      }
    }
  }

  /**
   * Publish multiple events in order.
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
