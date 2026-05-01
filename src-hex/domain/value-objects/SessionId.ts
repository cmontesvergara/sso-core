/**
 * SessionId Value Object
 * Typed identifier for Sessions
 * Immutable
 */
export class SessionId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): SessionId {
    if (!id) {
      throw new Error('SessionId cannot be empty');
    }
    return new SessionId(id);
  }

  equals(other: SessionId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
