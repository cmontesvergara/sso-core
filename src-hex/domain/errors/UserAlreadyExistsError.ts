import { DomainError } from './DomainError';

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';
  readonly statusCode = 409;
  readonly email: string;

  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.email = email;
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype);
  }
}
