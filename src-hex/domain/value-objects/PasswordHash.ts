import { Result } from './Result';
import { WeakPasswordError } from '../errors/WeakPasswordError';

/**
 * PasswordHash Value Object
 * Represents a hashed password (not the plain password)
 * Immutable
 */
export class PasswordHash {
  private constructor(private readonly _hash: string) {
    Object.freeze(this);
  }

  get hash(): string {
    return this._hash;
  }

  static create(hash: string): Result<PasswordHash, WeakPasswordError> {
    if (!hash || hash.length < 32) {
      return Result.fail(new WeakPasswordError('Invalid hash format'));
    }

    return Result.ok(new PasswordHash(hash));
  }

  static createUnsafe(hash: string): PasswordHash {
    return new PasswordHash(hash);
  }

  equals(other: PasswordHash): boolean {
    return this._hash === other._hash;
  }

  toString(): string {
    return this._hash;
  }
}
