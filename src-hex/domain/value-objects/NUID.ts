/**
 * NUID (User Numeric Unique Identifier) Value Object
 * Immutable identifier for users
 */
export class NUID {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(nuid: string): NUID {
    if (!nuid || nuid.length < 1) {
      throw new Error('NUID cannot be empty');
    }
    return new NUID(nuid);
  }

  equals(other: NUID): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
