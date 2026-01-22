/**
 * OTP Validation Schemas
 * Joi schemas for OTP (One-Time Password) endpoints
 */

import Joi from 'joi';

export const generateOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
});

export const verifyOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

export const enableOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

export const disableOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  token: Joi.string().length(6).pattern(/^\d+$/).optional(),
});

export const verifyBackupCodeSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  backupCode: Joi.string().required(),
});
