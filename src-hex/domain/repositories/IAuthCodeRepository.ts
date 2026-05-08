import { AuthCode } from '../entities/AuthCode';
import { AuthCodeId } from '../value-objects/Ids';
import { UserId } from '../value-objects/UserId';
import { TenantId } from '../value-objects/TenantId';

/**
 * IAuthCodeRepository
 * Interface for AuthCode persistence operations
 * Domain layer - no implementation details
 */
export interface IAuthCodeRepository {
  /**
   * Find auth code by ID
   */
  findById(id: AuthCodeId): Promise<AuthCode | null>;

  /**
   * Find auth code by code value
   */
  findByCode(code: string): Promise<AuthCode | null>;

  /**
   * Save a new auth code
   */
  save(authCode: AuthCode): Promise<void>;

  /**
   * Update an existing auth code
   */
  update(authCode: AuthCode): Promise<void>;

  /**
   * Delete an auth code
   */
  delete(id: AuthCodeId): Promise<void>;

  /**
   * Delete expired codes
   */
  deleteExpired(): Promise<number>;

  /**
   * Find pending codes by user
   */
  findPendingByUser(userId: UserId): Promise<AuthCode[]>;

  /**
   * Count active codes for user in tenant
   */
  countActiveForUserInTenant(userId: UserId, tenantId: TenantId): Promise<number>;
}
