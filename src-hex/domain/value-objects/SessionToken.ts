/**
 * SessionToken Value Object
 * Represents a token (access or refresh) with metadata
 * Immutable
 */
export class SessionToken {
  private constructor(
    private readonly _token: string,
    private readonly _expiresAt: Date,
    private readonly _type: 'access' | 'refresh'
  ) {
    Object.freeze(this);
  }

  get token(): string {
    return this._token;
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get type(): 'access' | 'refresh' {
    return this._type;
  }

  get isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  static createAccess(token: string, expiresInSeconds: number): SessionToken {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return new SessionToken(token, expiresAt, 'access');
  }

  static createRefresh(token: string, expiresInSeconds: number): SessionToken {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return new SessionToken(token, expiresAt, 'refresh');
  }

  equals(other: SessionToken): boolean {
    return this._token === other._token;
  }

  toString(): string {
    return `${this._type}:${this._token.substring(0, 10)}...`;
  }
}
