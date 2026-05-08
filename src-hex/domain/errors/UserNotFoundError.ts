import { DomainError } from './DomainError';

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  readonly statusCode = 404;

  constructor(identifier: string) {
    super(`User not found with identifier: ${identifier}`);
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}
