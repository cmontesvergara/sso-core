import Joi from 'joi';
import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * ValidationError
 * Thrown when Joi schema validation fails.
 * ErrorHandlerMiddleware maps this to HTTP 422.
 */
export class ValidationError extends Error {
  readonly statusCode = 422;
  readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// ── Joi options (shared) ──────────────────────────────────────────────────────

const JOI_OPTS: Joi.ValidationOptions = {
  abortEarly: false,   // collect ALL errors, not just the first
  stripUnknown: true,  // remove undeclared fields from body
  convert: true,       // coerce types where safe (e.g. '  email@x.co  ' → trim)
};

// ── Middleware factory ────────────────────────────────────────────────────────

function validate(schema: Joi.ObjectSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, JOI_OPTS);

    if (error) {
      const errors: Record<string, string> = {};
      for (const detail of error.details) {
        const key = detail.path.join('.') || '_body';
        errors[key] = detail.message.replace(/['"]/g, '');
      }
      return next(new ValidationError(errors));
    }

    req.body = value; // replace body with sanitized/coerced value
    next();
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v3/auth/login
 * Requires: password + appId + tenantId + (email XOR nuid)
 */
export const validateLogin = validate(
  Joi.object({
    email:    Joi.string().email().lowercase().trim(),
    nuid:     Joi.string().trim(),
    password: Joi.string().min(1).required(),
    appId:    Joi.string().trim().required(),
    tenantId: Joi.string().trim().required(),
  }).or('email', 'nuid')   // at least one of email / nuid must be present
);

/**
 * POST /api/v3/auth/refresh
 * Requires: refreshToken + tenantId + appId
 */
export const validateRefresh = validate(
  Joi.object({
    refreshToken: Joi.string().required(),
    tenantId:     Joi.string().trim().required(),
    appId:        Joi.string().trim().required(),
  })
);

/**
 * POST /api/v3/auth/exchange
 * Requires: code + redirect_uri + app_id
 */
export const validateExchange = validate(
  Joi.object({
    code:          Joi.string().required(),
    redirect_uri:  Joi.string().uri().required(),
    app_id:        Joi.string().trim().required(),
    code_verifier: Joi.string(),  // optional — PKCE
  })
);

/**
 * POST /api/v3/auth/authorize
 * Requires: tenantId + appId + redirectUri
 */
export const validateAuthorize = validate(
  Joi.object({
    tenantId:            Joi.string().trim().required(),
    appId:               Joi.string().trim().required(),
    redirectUri:         Joi.string().uri().required(),
    codeChallenge:       Joi.string(),
    codeChallengeMethod: Joi.string().valid('S256', 'plain'),
    state:               Joi.string(),
    nonce:               Joi.string(),
  })
);

/**
 * POST /api/v3/users/register
 * Requires: email + password (≥8) + firstName + lastName + tenantId
 */
export const validateRegister = validate(
  Joi.object({
    email:     Joi.string().email().lowercase().trim().required(),
    password:  Joi.string().min(8).required(),
    firstName: Joi.string().trim().required(),
    lastName:  Joi.string().trim().required(),
    tenantId:  Joi.string().trim().required(),
    nuid:      Joi.string().trim(),
    phone:     Joi.string().trim(),
  })
);
