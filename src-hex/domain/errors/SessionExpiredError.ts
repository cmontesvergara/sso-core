import { DomainError } from './DomainError';

export class SessionExpiredError extends DomainError {
  readonly code = 'SESSION_EXPIRED';
  readonly statusCode = 401;
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session has expired: ${sessionId}`);
    this.sessionId = sessionId;
    Object.setPrototypeOf(this, SessionExpiredError.prototype);
  }
}
