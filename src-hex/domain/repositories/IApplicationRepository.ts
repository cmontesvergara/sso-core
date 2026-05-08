import { Application, TenantApplication } from '../entities/Application';
import { ApplicationId } from '../value-objects/Ids';
import { TenantId } from '../value-objects/TenantId';

/**
 * IApplicationRepository
 * Interface for Application persistence operations
 * Domain layer - no implementation details
 */
export interface IApplicationRepository {
  /**
   * Find application by ID
   */
  findById(id: ApplicationId): Promise<Application | null>;

  /**
   * Find application by client ID
   */
  findByClientId(clientId: string): Promise<Application | null>;

  /**
   * Save a new application
   */
  save(application: Application): Promise<void>;

  /**
   * Update an existing application
   */
  update(application: Application): Promise<void>;

  /**
   * Delete an application
   */
  delete(id: ApplicationId): Promise<void>;

  /**
   * Find active applications
   */
  findActive(): Promise<Application[]>;

  /**
   * Check if client ID exists
   */
  existsByClientId(clientId: string): Promise<boolean>;

  /**
   * Get tenant application configuration
   */
  findTenantApplication(
    tenantId: TenantId,
    applicationId: ApplicationId
  ): Promise<TenantApplication | null>;

  /**
   * Save tenant application configuration
   */
  saveTenantApplication(tenantApplication: TenantApplication): Promise<void>;

  /**
   * Update tenant application configuration
   */
  updateTenantApplication(tenantApplication: TenantApplication): Promise<void>;
}
