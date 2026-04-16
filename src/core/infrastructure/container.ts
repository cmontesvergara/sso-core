/**
 * Dependency Injection Container
 * Simple IoC container for managing service lifecycles
 */

type ServiceFactory<T> = (container: Container) => T;

interface ServiceRegistration {
  factory: ServiceFactory<any>;
  singleton: boolean;
  instance?: any;
}

export class Container {
  private registrations: Map<string, ServiceRegistration> = new Map();
  private resolved: Map<string, any> = new Map();

  /**
   * Register a service factory
   * @param token - Service identifier/token
   * @param factory - Factory function that creates the service
   * @param singleton - If true, service is instantiated once and reused
   */
  bind<T>(token: string, factory: ServiceFactory<T>, singleton: boolean = true): this {
    this.registrations.set(token, { factory, singleton });
    return this;
  }

  /**
   * Register a singleton service (shorthand for bind with singleton=true)
   */
  singleton<T>(token: string, factory: ServiceFactory<T>): this {
    return this.bind(token, factory, true);
  }

  /**
   * Register a transient service (shorthand for bind with singleton=false)
   * New instance created on each resolve
   */
  transient<T>(token: string, factory: ServiceFactory<T>): this {
    return this.bind(token, factory, false);
  }

  /**
   * Register an existing instance
   */
  instance<T>(token: string, instance: T): this {
    this.resolved.set(token, instance);
    return this;
  }

  /**
   * Resolve a service by token
   */
  get<T>(token: string): T {
    // Check if already resolved (for singletons or pre-registered instances)
    if (this.resolved.has(token)) {
      return this.resolved.get(token) as T;
    }

    // Get registration
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`Service not registered: ${token}`);
    }

    // Create instance
    const instance = registration.factory(this) as T;

    // Store if singleton
    if (registration.singleton) {
      this.resolved.set(token, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.registrations.has(token) || this.resolved.has(token);
  }

  /**
   * Clear all resolved instances (useful for testing)
   */
  clear(): void {
    this.resolved.clear();
  }

  /**
   * Clear a specific resolved instance
   */
  clearToken(token: string): void {
    this.resolved.delete(token);
  }
}

// Global container instance
const globalContainer = new Container();

export { globalContainer };
