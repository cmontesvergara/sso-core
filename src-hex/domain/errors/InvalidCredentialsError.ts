import { DomainError } from './DomainError';

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly statusCode = 401;

  constructor(message: string = 'Invalid credentials provided') {
    super(message);
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}
