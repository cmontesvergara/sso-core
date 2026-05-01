import { DomainError } from './DomainError';

export class WeakPasswordError extends DomainError {
  readonly code = 'WEAK_PASSWORD';
  readonly statusCode = 400;

  constructor(reason: string) {
    super(`Password does not meet security requirements: ${reason}`);
    Object.setPrototypeOf(this, WeakPasswordError.prototype);
  }
}
