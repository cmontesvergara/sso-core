import { DomainError } from './DomainError';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  readonly statusCode = 400;
  readonly email: string;

  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.email = email;
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}
