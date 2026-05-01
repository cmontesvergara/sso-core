import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { CreateTenantInput } from '../../dto/input/CreateTenantInput';
import { TenantResult } from '../../dto/output/TenantResult';
import { TenantCreatedEvent } from '../../../domain/events/TenantEvents';
import { Tenant, TenantSettings } from '../../../domain/entities/Tenant';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { UserId } from '../../../domain/value-objects/UserId';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';

/**
 * CreateTenantUseCase
 * Orchestrates tenant creation
 */
export class CreateTenantUseCase {
  constructor(
    private tenantRepository: ITenantRepository,
    private userRepository: IUserRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: CreateTenantInput): Promise<TenantResult> {
    // 1. Validate creator exists
    const creator = await this.userRepository.findById(UserId.create(input.createdByUserId));
    if (!creator) {
      throw new UserNotFoundError(input.createdByUserId);
    }

    // 2. Generate slug
    const slug = input.slug || this.generateSlug(input.name);

    // 3. Check slug availability
    const existingTenant = await this.tenantRepository.findBySlug(slug);
    if (existingTenant) {
      throw new Error(`Tenant with slug '${slug}' already exists`);
    }

    // 4. Create tenant
    const tenant = new Tenant(
      TenantId.create(this.generateId()),
      input.name,
      slug,
      'active',
      this.mapSettings(input.settings),
      new Date(),
      new Date()
    );

    await this.tenantRepository.save(tenant);

    // 5. Add creator as admin
    // Note: This would require updating user membership

    // 6. Publish event
    await this.eventBus.publish(new TenantCreatedEvent(tenant.id, tenant.name, creator.id));

    // 7. Log audit
    await this.auditService.log({
      type: 'TENANT_CREATED',
      tenantId: tenant.id.value,
      userId: creator.id.value,
    });

    return this.mapToResult(tenant, 1);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50);
  }

  private mapSettings(settings?: CreateTenantInput['settings']): TenantSettings {
    return {
      maxUsers: settings?.maxUsers,
      allowedDomains: settings?.allowedDomains,
      mfaRequired: settings?.mfaRequired,
      sessionTimeout: settings?.sessionTimeout,
    };
  }

  private mapToResult(tenant: Tenant, memberCount: number): TenantResult {
    return {
      id: tenant.id.value,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      settings: tenant.settings,
      memberCount,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
