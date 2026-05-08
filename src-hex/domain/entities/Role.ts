import { RoleId } from '../value-objects/Ids';
import { RoleName, Permission } from '../value-objects/RoleName';

/**
 * RoleStatus
 * Possible states of a role
 */
export type RoleStatus = 'active' | 'inactive';

/**
 * Role Entity
 * Represents a role that defines permissions
 * Immutable
 */
export class Role {
  constructor(
    private readonly _id: RoleId,
    private readonly _name: RoleName,
    private readonly _description: string,
    private readonly _permissions: Permission[],
    private readonly _isSystem: boolean, // System roles cannot be deleted/modified
    private readonly _status: RoleStatus,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._permissions);
  }

  // Getters
  get id(): RoleId {
    return this._id;
  }

  get name(): RoleName {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get permissions(): ReadonlyArray<Permission> {
    return this._permissions;
  }

  get isSystem(): boolean {
    return this._isSystem;
  }

  get status(): RoleStatus {
    return this._status;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  /**
   * Check if role is active
   */
  isActive(): boolean {
    return this._status === 'active';
  }

  /**
   * Check if role has a specific permission
   */
  hasPermission(permission: string): boolean {
    return this._permissions.some((p) => p.value === permission);
  }

  /**
   * Check if role has all specified permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  /**
   * Check if role has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  /**
   * Create role with additional permission
   */
  addPermission(permission: Permission): Role {
    if (this.hasPermission(permission.value)) {
      return this;
    }
    return new Role(
      this._id,
      this._name,
      this._description,
      [...this._permissions, permission],
      this._isSystem,
      this._status,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Create role without a specific permission
   */
  removePermission(permission: Permission): Role {
    return new Role(
      this._id,
      this._name,
      this._description,
      this._permissions.filter((p) => p.value !== permission.value),
      this._isSystem,
      this._status,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Create role with updated status
   */
  withStatus(newStatus: RoleStatus): Role {
    return new Role(
      this._id,
      this._name,
      this._description,
      this._permissions,
      this._isSystem,
      newStatus,
      this._createdAt,
      new Date()
    );
  }
}

/**
 * PermissionSet
 * Utility for working with collections of permissions
 */
export class PermissionSet {
  private readonly _permissions: Set<string>;

  constructor(permissions: Permission[] = []) {
    this._permissions = new Set(permissions.map((p) => p.value));
  }

  add(permission: Permission): PermissionSet {
    const newSet = new Set(this._permissions);
    newSet.add(permission.value);
    return new PermissionSet([...newSet].map((p) => Permission.create(p)));
  }

  remove(permission: Permission): PermissionSet {
    const newSet = new Set(this._permissions);
    newSet.delete(permission.value);
    return new PermissionSet([...newSet].map((p) => Permission.create(p)));
  }

  has(permission: string): boolean {
    return this._permissions.has(permission);
  }

  hasAll(permissions: string[]): boolean {
    return permissions.every((p) => this._permissions.has(p));
  }

  hasAny(permissions: string[]): boolean {
    return permissions.some((p) => this._permissions.has(p));
  }

  toArray(): Permission[] {
    return [...this._permissions].map((p) => Permission.create(p));
  }
}
