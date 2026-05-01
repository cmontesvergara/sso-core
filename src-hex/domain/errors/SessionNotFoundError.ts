import { DomainError } from './DomainError';

export class SessionNotFoundError extends DomainError {
  readonly code = 'SESSION_NOT_FOUND';
  readonly statusCode = 404;
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.sessionId = sessionId;
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}
