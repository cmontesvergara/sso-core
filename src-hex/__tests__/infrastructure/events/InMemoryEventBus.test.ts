import { InMemoryEventBus } from '@hex/infrastructure/external-services/events/InMemoryEventBus';
import { DomainEvent } from '@hex/domain/events/DomainEvent';

class TestEvent extends DomainEvent {
  readonly eventType = 'TestEvent';
  constructor(public readonly payload: string) {
    super();
  }
}

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it('should call registered handler when event is published', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    bus.subscribe('TestEvent', handler);

    await bus.publish(new TestEvent('hello'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(TestEvent);
    expect((handler.mock.calls[0][0] as TestEvent).payload).toBe('hello');
  });

  it('should call multiple handlers for the same event type', async () => {
    const h1 = jest.fn().mockResolvedValue(undefined);
    const h2 = jest.fn().mockResolvedValue(undefined);
    bus.subscribe('TestEvent', h1);
    bus.subscribe('TestEvent', h2);

    await bus.publish(new TestEvent('multi'));

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('should not call handlers for a different event type', async () => {
    const testHandler = jest.fn().mockResolvedValue(undefined);
    const anotherHandler = jest.fn().mockResolvedValue(undefined);
    bus.subscribe('TestEvent', testHandler);
    bus.subscribe('AnotherEvent', anotherHandler);

    await bus.publish(new TestEvent('isolation'));

    expect(testHandler).toHaveBeenCalledTimes(1);
    expect(anotherHandler).not.toHaveBeenCalled();
  });

  it('should not throw if no handlers are registered for the event', async () => {
    await expect(bus.publish(new TestEvent('no-handlers'))).resolves.not.toThrow();
  });

  it('should continue executing remaining handlers if one throws', async () => {
    const failingHandler = jest.fn().mockRejectedValue(new Error('handler failed'));
    const successHandler = jest.fn().mockResolvedValue(undefined);

    bus.subscribe('TestEvent', failingHandler);
    bus.subscribe('TestEvent', successHandler);

    // Should not throw — errors are caught internally
    await expect(bus.publish(new TestEvent('resilience'))).resolves.not.toThrow();
    expect(successHandler).toHaveBeenCalledTimes(1);
  });

  it('should publish all events in order via publishAll', async () => {
    const order: string[] = [];

    bus.subscribe('TestEvent', async (e: TestEvent) => {
      order.push(e.payload);
    });

    await bus.publishAll([new TestEvent('first'), new TestEvent('second'), new TestEvent('third')]);

    expect(order).toEqual(['first', 'second', 'third']);
  });
});
