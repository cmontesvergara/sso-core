/**
 * Tenant Validation Schemas
 * Joi schemas for tenant and role management endpoints
 */

import Joi from 'joi';

// Tenant Schemas
export const createTenantSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(3)
    .max(100)
    .required(),
});

export const updateTenantSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(3)
    .max(100)
    .optional(),
}).min(1);

export const tenantIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Tenant Member Schemas
export const addTenantMemberSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().required(),
  role: Joi.string().valid('owner', 'admin', 'member', 'guest').required(),
});

export const updateTenantMemberRoleSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member', 'guest').required(),
});

// Role Schemas
export const createRoleSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  name: Joi.string().trim().min(3).max(100).required(),
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
});

export const roleIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Permission Schemas
export const createPermissionSchema = Joi.object({
  roleId: Joi.string().uuid().required(),
  resource: Joi.string().trim().max(100).required(),
  action: Joi.string().valid('create', 'read', 'update', 'delete', 'manage').required(),
});

export const permissionIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
