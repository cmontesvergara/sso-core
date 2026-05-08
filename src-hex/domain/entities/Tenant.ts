import { TenantId } from '../value-objects/TenantId';
import { RoleName, Permission } from '../value-objects/RoleName';

/**
 * TenantStatus
 * Possible states of a tenant
 */
export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'pending_setup';

/**
 * TenantSettings
 * Configuration for a tenant
 */
export interface TenantSettings {
  maxUsers?: number;
  allowedDomains?: string[];
  mfaRequired?: boolean;
  sessionTimeout?: number; // in seconds
}

/**
 * Tenant Entity
 * Represents an organization/company in the system
 * Immutable
 */
export class Tenant {
  constructor(
    private readonly _id: TenantId,
    private readonly _name: string,
    private readonly _slug: string,
    private readonly _status: TenantStatus,
    private readonly _settings: TenantSettings,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._settings);
  }

  // Getters
  get id(): TenantId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
  }

  get status(): TenantStatus {
    return this._status;
  }

  get settings(): TenantSettings {
    return { ...this._settings };
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  /**
   * Check if tenant is active
   */
  isActive(): boolean {
    return this._status === 'active';
  }

  /**
   * Check if domain is allowed for this tenant
   */
  isDomainAllowed(email: string): boolean {
    if (!this._settings.allowedDomains || this._settings.allowedDomains.length === 0) {
      return true;
    }
    const domain = email.split('@')[1];
    return this._settings.allowedDomains.includes(domain);
  }

  /**
   * Check if MFA is required
   */
  isMFARequired(): boolean {
    return this._settings.mfaRequired ?? false;
  }

  /**
   * Get session timeout (default 15 minutes)
   */
  getSessionTimeout(): number {
    return this._settings.sessionTimeout ?? 900;
  }

  /**
   * Create tenant with updated status
   */
  withStatus(newStatus: TenantStatus): Tenant {
    return new Tenant(
      this._id,
      this._name,
      this._slug,
      newStatus,
      this._settings,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Create tenant with updated settings
   */
  withSettings(newSettings: Partial<TenantSettings>): Tenant {
    return new Tenant(
      this._id,
      this._name,
      this._slug,
      this._status,
      { ...this._settings, ...newSettings },
      this._createdAt,
      new Date()
    );
  }
}

/**
 * TenantMembership Entity
 * Represents a user's membership in a tenant
 * Immutable
 */
export class TenantMembership {
  constructor(
    private readonly _tenantId: TenantId,
    private readonly _userId: string,
    private readonly _role: RoleName,
    private readonly _permissions: Permission[],
    private readonly _joinedAt: Date,
    private readonly _isActive: boolean = true
  ) {
    Object.freeze(this);
    Object.freeze(this._permissions);
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get userId(): string {
    return this._userId;
  }

  get role(): RoleName {
    return this._role;
  }

  get permissions(): ReadonlyArray<Permission> {
    return this._permissions;
  }

  get joinedAt(): Date {
    return new Date(this._joinedAt);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    return this._permissions.some((p) => p.value === permission);
  }

  /**
   * Create membership with new role
   */
  withRole(newRole: RoleName): TenantMembership {
    return new TenantMembership(
      this._tenantId,
      this._userId,
      newRole,
      this._permissions,
      this._joinedAt,
      this._isActive
    );
  }

  /**
   * Activate/deactivate membership
   */
  withActiveStatus(isActive: boolean): TenantMembership {
    return new TenantMembership(
      this._tenantId,
      this._userId,
      this._role,
      this._permissions,
      this._joinedAt,
      isActive
    );
  }
}
