/**
 * ApplicationId Value Object
 * Typed identifier for Applications
 * Immutable
 */
export class ApplicationId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): ApplicationId {
    if (!id) {
      throw new Error('ApplicationId cannot be empty');
    }
    return new ApplicationId(id);
  }

  equals(other: ApplicationId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * AuthCodeId Value Object
 * Typed identifier for Authorization Codes
 * Immutable
 */
export class AuthCodeId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): AuthCodeId {
    if (!id) {
      throw new Error('AuthCodeId cannot be empty');
    }
    return new AuthCodeId(id);
  }

  equals(other: AuthCodeId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * RoleId Value Object
 * Typed identifier for Roles
 * Immutable
 */
export class RoleId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): RoleId {
    if (!id) {
      throw new Error('RoleId cannot be empty');
    }
    return new RoleId(id);
  }

  equals(other: RoleId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * RefreshTokenId Value Object
 * Typed identifier for Refresh Tokens
 * Immutable
 */
export class RefreshTokenId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(id: string): RefreshTokenId {
    if (!id) {
      throw new Error('RefreshTokenId cannot be empty');
    }
    return new RefreshTokenId(id);
  }

  equals(other: RefreshTokenId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
