import { NextFunction, Response, Router } from 'express';
import * as Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { RoleService_Instance } from '../services/role';

const router = Router();

/**
 * Validation schemas
 */
const createRoleSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  tenantId: Joi.string().required().uuid(),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().optional().min(2).max(50),
});

const createPermissionSchema = Joi.object({
  applicationId: Joi.string().required().uuid(),
  resource: Joi.string().required().min(2).max(50),
  action: Joi.string().required().min(2).max(50),
});

const removePermissionByResourceActionSchema = Joi.object({
  applicationId: Joi.string().required().uuid(),
  resource: Joi.string().required().min(2).max(50),
  action: Joi.string().required().min(2).max(50),
});

/**
 * POST /api/v1/role
 * Create a custom role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant specified in body
 */
router.post(
  '/',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createRoleSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const userId = req.ssoUser?.userId;
      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const role = await RoleService_Instance.createRole(value, userId);

      res.status(201).json({
        success: true,
        role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/role/tenant/:tenantId
 * List all roles for a tenant
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/tenant/:tenantId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const roles = await RoleService_Instance.getTenantRoles(tenantId, userId);

      res.json({
        success: true,
        roles,
        count: roles.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/role/:roleId
 * Get role details with permissions
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/:roleId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const role = await RoleService_Instance.getRoleById(roleId, userId);

      res.json({
        success: true,
        role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/role/:roleId
 * Update a role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 * Cannot update default roles (admin, member, viewer)
 */
router.put(
  '/:roleId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateRoleSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const role = await RoleService_Instance.updateRole(roleId, value, userId);

      res.json({
        success: true,
        role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/role/:roleId
 * Delete a role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 * Cannot delete default roles (admin, member, viewer)
 */
router.delete(
  '/:roleId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      await RoleService_Instance.deleteRole(roleId, userId);

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/role/:roleId/permission
 * Add permission to a role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 * Cannot modify default roles (admin, member, viewer)
 */
router.post(
  '/:roleId/permission',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createPermissionSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const permission = await RoleService_Instance.addPermission(roleId, value, userId);

      res.status(201).json({
        success: true,
        permission,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/role/:roleId/permission
 * List all permissions for a role
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/:roleId/permission',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const permissions = await RoleService_Instance.getRolePermissions(roleId, userId);

      res.json({
        success: true,
        permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/role/:roleId/permission/:permissionId
 * Remove permission from role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 * Cannot modify default roles (admin, member, viewer)
 */
router.delete(
  '/:roleId/permission/:permissionId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roleId, permissionId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      await RoleService_Instance.removePermission(roleId, permissionId, userId);

      res.json({
        success: true,
        message: 'Permission removed from role',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/role/:roleId/permission
 * Remove permission by resource and action (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 * Body: { resource: string, action: string }
 */
router.delete(
  '/:roleId/permission',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = removePermissionByResourceActionSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const { roleId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      await RoleService_Instance.removePermissionByResourceAction(
        roleId,
        value.applicationId,
        value.resource,
        value.action,
        userId
      );

      res.json({
        success: true,
        message: 'Permission removed from role',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
