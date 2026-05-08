import { Tenant } from '../entities/Tenant';
import { TenantId } from '../value-objects/TenantId';

/**
 * ITenantRepository
 * Interface for Tenant persistence operations
 * Domain layer - no implementation details
 */
export interface ITenantRepository {
  /**
   * Find tenant by ID
   */
  findById(id: TenantId): Promise<Tenant | null>;

  /**
   * Find tenant by slug
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Save a new tenant
   */
  save(tenant: Tenant): Promise<void>;

  /**
   * Update an existing tenant
   */
  update(tenant: Tenant): Promise<void>;

  /**
   * Delete a tenant
   */
  delete(id: TenantId): Promise<void>;

  /**
   * List all tenants
   */
  findAll(): Promise<Tenant[]>;

  /**
   * Find active tenants
   */
  findActive(): Promise<Tenant[]>;

  /**
   * Check if slug is available
   */
  isSlugAvailable(slug: string): Promise<boolean>;
}
