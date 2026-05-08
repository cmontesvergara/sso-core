import { DomainError } from './DomainError';

export class InvalidAuthCodeError extends DomainError {
  readonly code = 'INVALID_AUTH_CODE';
  readonly statusCode = 400;

  constructor(reason: string = 'Authorization code is invalid or expired') {
    super(reason);
    Object.setPrototypeOf(this, InvalidAuthCodeError.prototype);
  }
}
