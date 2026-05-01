/**
 * DomainError
 * Base class for all domain errors
 * No external dependencies - pure TypeScript
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export interface ErrorDetails {
  field?: string;
  message: string;
}

export interface ErrorContext {
  [key: string]: unknown;
}
