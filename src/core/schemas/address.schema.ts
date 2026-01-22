/**
 * Address Validation Schemas
 * Joi schemas for address management endpoints
 */

import Joi from 'joi';

export const createAddressSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  country: Joi.string().trim().max(100).required(),
  province: Joi.string().trim().max(100).required(),
  city: Joi.string().trim().max(100).required(),
  detail: Joi.string().trim().max(500).required(),
  postalCode: Joi.string().trim().max(20).optional().allow(null, ''),
});

export const updateAddressSchema = Joi.object({
  country: Joi.string().trim().max(100).optional(),
  province: Joi.string().trim().max(100).optional(),
  city: Joi.string().trim().max(100).optional(),
  detail: Joi.string().trim().max(500).optional(),
  postalCode: Joi.string().trim().max(20).optional().allow(null, ''),
}).min(1);

export const addressIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
