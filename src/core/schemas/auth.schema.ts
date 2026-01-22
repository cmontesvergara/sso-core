/**
 * Authentication Validation Schemas
 * Joi schemas for authentication endpoints
 */

import Joi from 'joi';

export const signupSchema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: Joi.string().trim().max(100).required(),
  nuid: Joi.string().trim().max(10).required(),
  phone: Joi.string().trim().max(10).required(),
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).required(),
  secondName: Joi.string().trim().max(100).allow(null, '').optional(),
  secondLastName: Joi.string().trim().max(100).allow(null, '').optional(),
  // Additional Information
  birthDate: Joi.date().allow(null).optional(),
  gender: Joi.string().trim().max(20).allow(null, '').optional(),
  nationality: Joi.string().trim().max(100).allow(null, '').optional(),
  birthPlace: Joi.string().trim().max(200).allow(null, '').optional(),
  placeOfResidence: Joi.string().trim().max(200).allow(null, '').optional(),
  occupation: Joi.string().trim().max(100).allow(null, '').optional(),
  maritalStatus: Joi.string()
    .trim()
    .valid('single', 'married', 'divorced', 'widowed', 'other')
    .allow(null, '')
    .optional(),
  // Secure Information
  recoveryPhone: Joi.string().trim().max(20).allow(null, '').optional(),
  recoveryEmail: Joi.string().email().trim().lowercase().allow(null, '').optional(),
});

export const signinSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const signoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
  all: Joi.boolean().optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});
