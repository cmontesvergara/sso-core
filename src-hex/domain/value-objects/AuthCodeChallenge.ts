/**
 * AuthCodeChallenge Value Object
 * PKCE code_challenge and verifier
 * Immutable
 */
export class AuthCodeChallenge {
  private constructor(
    private readonly _codeChallenge: string,
    private readonly _codeChallengeMethod: string,
    private readonly _codeVerifier?: string
  ) {
    Object.freeze(this);
  }

  get codeChallenge(): string {
    return this._codeChallenge;
  }

  get codeChallengeMethod(): string {
    return this._codeChallengeMethod;
  }

  get codeVerifier(): string | undefined {
    return this._codeVerifier;
  }

  static create(
    codeChallenge: string,
    method: string = 'S256',
    verifier?: string
  ): AuthCodeChallenge {
    return new AuthCodeChallenge(codeChallenge, method, verifier);
  }

  verify(verifier: string): boolean {
    if (!this._codeVerifier) {
      return false;
    }
    return this._codeVerifier === verifier;
  }

  toString(): string {
    return `${this._codeChallengeMethod}:${this._codeChallenge.substring(0, 10)}...`;
  }
}
