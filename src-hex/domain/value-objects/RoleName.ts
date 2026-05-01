/**
 * RoleName Value Object
 * Immutable role identifier
 */
export class RoleName {
  private static readonly VALID_ROLES = ['admin', 'member', 'viewer'] as const;

  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(role: string): RoleName {
    if (!RoleName.VALID_ROLES.includes(role as any)) {
      throw new Error(`Invalid role: ${role}. Valid roles: ${RoleName.VALID_ROLES.join(', ')}`);
    }
    return new RoleName(role);
  }

  static createUnsafe(role: string): RoleName {
    return new RoleName(role);
  }

  equals(other: RoleName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Permission Value Object
 * Immutable permission identifier
 */
export class Permission {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(permission: string): Permission {
    return new Permission(permission);
  }

  equals(other: Permission): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
