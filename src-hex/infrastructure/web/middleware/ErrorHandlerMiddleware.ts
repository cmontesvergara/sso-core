import { Request, Response, NextFunction } from 'express';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { UserAlreadyExistsError } from '../../../domain/errors/UserAlreadyExistsError';
import { DocumentAlreadyExistsError } from '../../../domain/errors/DocumentAlreadyExistsError';
import { SessionExpiredError } from '../../../domain/errors/SessionExpiredError';
import { SessionNotFoundError } from '../../../domain/errors/SessionNotFoundError';
import { TenantAccessDeniedError } from '../../../domain/errors/TenantAccessDeniedError';
import { WeakPasswordError } from '../../../domain/errors/WeakPasswordError';
import { InvalidAuthCodeError } from '../../../domain/errors/InvalidAuthCodeError';
import { TokenRevokedError } from '../../../domain/errors/TokenRevokedError';
import { ValidationError } from './ValidationMiddleware';

/**
 * DomainError → HTTP status map
 */
const ERROR_STATUS_MAP = new Map<Function, number>([
  [InvalidCredentialsError, 401],
  [SessionExpiredError, 401],
  [TokenRevokedError, 401],
  [UserNotFoundError, 404],
  [SessionNotFoundError, 404],
  [UserAlreadyExistsError, 409],
  [DocumentAlreadyExistsError, 409],
  [WeakPasswordError, 422],
  [InvalidAuthCodeError, 422],
  [TenantAccessDeniedError, 403],
]);

/**
 * ErrorHandlerMiddleware
 * Converts DomainErrors to structured JSON HTTP responses.
 * Must be registered LAST in the Express middleware chain.
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Joi validation errors
  if (err.name === 'ValidationError' && (err as any).errors) {
    res.status(422).json({
      error: 'ValidationError',
      message: 'Validation failed',
      errors: (err as ValidationError).errors,
    });
    return;
  }

  // JWT validation errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Unauthorized', message: err.message });
    return;
  }

  // Domain errors
  const httpStatus = ERROR_STATUS_MAP.get(err.constructor) ?? null;
  if (httpStatus) {
    res.status(httpStatus).json({
      error: err.constructor.name,
      message: err.message,
    });
    return;
  }

  // Unknown errors — log and return 500
  console.error('[ErrorHandler] Unhandled error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
