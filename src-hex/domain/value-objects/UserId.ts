/**
 * UserId Value Object
 * Typed identifier for Users
 * Immutable
 */
export class UserId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): UserId {
    if (!id) {
      throw new Error('UserId cannot be empty');
    }
    return new UserId(id);
  }

  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
