import { Role } from '../entities/Role';
import { RoleId } from '../value-objects/Ids';
import { TenantId } from '../value-objects/TenantId';

/**
 * IRoleRepository
 * Interface for Role persistence operations
 * Domain layer - no implementation details
 */
export interface IRoleRepository {
  /**
   * Find role by ID
   */
  findById(id: RoleId): Promise<Role | null>;

  /**
   * Find role by name
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * Save a new role
   */
  save(role: Role): Promise<void>;

  /**
   * Update an existing role
   */
  update(role: Role): Promise<void>;

  /**
   * Delete a role
   */
  delete(id: RoleId): Promise<void>;

  /**
   * Find all roles
   */
  findAll(): Promise<Role[]>;

  /**
   * Find active roles
   */
  findActive(): Promise<Role[]>;

  /**
   * Find roles for tenant
   */
  findByTenant(tenantId: TenantId): Promise<Role[]>;
}
