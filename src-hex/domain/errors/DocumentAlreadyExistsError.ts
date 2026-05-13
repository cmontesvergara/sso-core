import { DomainError } from './DomainError';

export class DocumentAlreadyExistsError extends DomainError {
  readonly code = 'DOCUMENT_ALREADY_EXISTS';
  readonly statusCode = 409;
  readonly document: string;

  constructor(document: string) {
    super(`El documento ${document} ya se encuentra registrado`);
    this.document = document;
    Object.setPrototypeOf(this, DocumentAlreadyExistsError.prototype);
  }
}
