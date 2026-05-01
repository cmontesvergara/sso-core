import { DomainError } from './DomainError';

export class TokenRevokedError extends DomainError {
  readonly code = 'TOKEN_REVOKED';
  readonly statusCode = 401;
  readonly tokenId: string;

  constructor(tokenId: string) {
    super(`Token has been revoked: ${tokenId}`);
    this.tokenId = tokenId;
    Object.setPrototypeOf(this, TokenRevokedError.prototype);
  }
}
