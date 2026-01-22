/**
 * Email Verification Validation Schemas
 * Joi schemas for email verification endpoints
 */

import Joi from 'joi';

export const createEmailVerificationSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  email: Joi.string().email().trim().lowercase().required(),
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const resendVerificationSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});
