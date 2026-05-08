/**
 * TenantId Value Object
 * Typed identifier for Tenants
 * Immutable
 */
export class TenantId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): TenantId {
    if (!id) {
      throw new Error('TenantId cannot be empty');
    }
    return new TenantId(id);
  }

  equals(other: TenantId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
