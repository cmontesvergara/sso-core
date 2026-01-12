import { v4 as uuidv4 } from 'uuid';
import { Repository } from '../database/types';
import { Tenant } from '../types';

/**
 * Tenant Service for tenant management
 */
export class TenantService {
  private static instance: TenantService;

  private tenantRepository: Repository<Tenant>;

  private constructor(tenantRepository: Repository<Tenant>) {
    this.tenantRepository = tenantRepository;
  }

  static getInstance(tenantRepository: Repository<Tenant>): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService(tenantRepository);
    }
    return TenantService.instance;
  }

  /**
   * Create a new tenant
   */
  async createTenant(name: string, displayName?: string): Promise<Tenant> {
    const tenant: Tenant = {
      tenantId: uuidv4(),
      name,
      displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.tenantRepository.create(tenant);
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(tenantId);
  }

  /**
   * Get tenant by name
   */
  async getTenantByName(name: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ name } as Partial<Tenant>);
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> {
    return this.tenantRepository.update(tenantId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    return this.tenantRepository.delete(tenantId);
  }
}
