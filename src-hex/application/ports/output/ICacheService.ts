/**
 * ICacheService
 * Port for caching operations
 * Implemented in infrastructure layer (Redis)
 */
export interface ICacheService<T = any> {
  /**
   * Get value from cache
   */
  get(key: string): Promise<T | null>;

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values
   */
  getMany(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set multiple values
   */
  setMany(entries: Map<string, T>, ttlSeconds?: number): Promise<void>;
}
