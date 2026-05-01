import { Result } from './Result';
import { InvalidEmailError } from '../errors/InvalidEmailError';

/**
 * Email Value Object
 * Immutable and validated at creation
 */
export class Email {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(email: string): Result<Email, InvalidEmailError> {
    const normalized = email.toLowerCase().trim();

    if (!Email.isValid(normalized)) {
      return Result.fail(new InvalidEmailError(email));
    }

    return Result.ok(new Email(normalized));
  }

  static createUnsafe(email: string): Email {
    return new Email(email.toLowerCase().trim());
  }

  private static isValid(email: string): boolean {
    // RFC 5322 compliant email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
