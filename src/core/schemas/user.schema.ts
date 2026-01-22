/**
 * User Validation Schemas
 * Joi schemas for user management endpoints
 */

import Joi from 'joi';

export const createUserSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().trim().max(100).optional(),
  secondName: Joi.string().trim().max(100).optional().allow(null, ''),
  lastName: Joi.string().trim().max(100).optional(),
  secondLastName: Joi.string().trim().max(100).optional(),
  phone: Joi.string().trim().max(20).optional(),
  nuid: Joi.string().trim().max(50).optional().allow(null, ''),
  birthDate: Joi.date().optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional().allow(null),
  nationality: Joi.string().trim().max(100).optional().allow(null),
  birthPlace: Joi.string().trim().max(200).optional().allow(null),
  placeOfResidence: Joi.string().trim().max(200).optional().allow(null),
  occupation: Joi.string().trim().max(100).optional().allow(null),
  maritalStatus: Joi.string()
    .valid('single', 'married', 'divorced', 'widowed', 'other')
    .optional()
    .allow(null),
  recoveryPhone: Joi.string().trim().max(20).optional().allow(null),
  recoveryEmail: Joi.string().email().trim().lowercase().optional().allow(null),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim().max(100).optional(),
  secondName: Joi.string().trim().max(100).optional().allow(null, ''),
  lastName: Joi.string().trim().max(100).optional(),
  secondLastName: Joi.string().trim().max(100).optional(),
  phone: Joi.string().trim().max(20).optional(),
  nuid: Joi.string().trim().max(50).optional().allow(null, ''),
  birthDate: Joi.date().optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional().allow(null),
  nationality: Joi.string().trim().max(100).optional().allow(null),
  birthPlace: Joi.string().trim().max(200).optional().allow(null),
  placeOfResidence: Joi.string().trim().max(200).optional().allow(null),
  occupation: Joi.string().trim().max(100).optional().allow(null),
  maritalStatus: Joi.string()
    .valid('single', 'married', 'divorced', 'widowed', 'other')
    .optional()
    .allow(null),
  recoveryPhone: Joi.string().trim().max(20).optional().allow(null),
  recoveryEmail: Joi.string().email().trim().lowercase().optional().allow(null),
  userStatus: Joi.string().valid('active', 'inactive', 'suspended', 'deleted').optional(),
}).min(1);

export const userIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export const listUsersSchema = Joi.object({
  skip: Joi.number().integer().min(0).optional().default(0),
  take: Joi.number().integer().min(1).max(100).optional().default(10),
  status: Joi.string().valid('active', 'inactive', 'suspended', 'deleted').optional(),
  search: Joi.string().trim().optional(),
});
