import { User } from '../entities/User';
import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';
import { NUID } from '../value-objects/NUID';
import { TenantId } from '../value-objects/TenantId';

/**
 * IUserRepository
 * Interface for User persistence operations
 * Domain layer - no implementation details
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find user by NUID
   */
  findByNUID(nuid: NUID): Promise<User | null>;

  /**
   * Find users by tenant
   */
  findByTenant(tenantId: TenantId): Promise<User[]>;

  /**
   * Save a new user
   */
  save(user: User): Promise<void>;

  /**
   * Update an existing user
   */
  update(user: User): Promise<void>;

  /**
   * Delete a user
   */
  delete(id: UserId): Promise<void>;

  /**
   * Check if user exists by email
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Check if user exists by NUID
   */
  existsByNUID(nuid: NUID): Promise<boolean>;

  /**
   * Count users in a tenant
   */
  countByTenant(tenantId: TenantId): Promise<number>;
}
