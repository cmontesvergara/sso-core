import { CreateTenantInput } from '../../dto/input/CreateTenantInput';
import { AddMemberInput } from '../../dto/input/AddMemberInput';
import { TenantResult } from '../../dto/output/TenantResult';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { UserId } from '../../../domain/value-objects/UserId';

/**
 * ITenantPort
 * Interface exposing tenant management capabilities
 */
export interface ITenantPort {
  /**
   * Create a new tenant
   */
  createTenant(input: CreateTenantInput): Promise<TenantResult>;

  /**
   * Add user to tenant
   */
  addMember(tenantId: TenantId, input: AddMemberInput): Promise<void>;

  /**
   * Remove user from tenant
   */
  removeMember(tenantId: TenantId, userId: UserId): Promise<void>;

  /**
   * Change user role in tenant
   */
  changeMemberRole(tenantId: TenantId, userId: UserId, newRole: string): Promise<void>;

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: TenantId): Promise<TenantResult | null>;
}
