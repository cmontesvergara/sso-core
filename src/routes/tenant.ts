import { NextFunction, Response, Router } from 'express';
import * as Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { requireSystemAdmin } from '../middleware/ssoSystemAdmin';
import { requireTenantAdmin, requireTenantMember } from '../middleware/tenantAuth';
import { TenantService_Instance } from '../services/tenant';

const router = Router();

/**
 * Validation schemas
 */
const createTenantSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  slug: Joi.string()
    .optional()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/),
  tenantAdminEmail: Joi.string().required().email(),
});

const inviteMemberSchema = Joi.object({
  email: Joi.string().required().email(),
  role: Joi.string().required().valid('admin', 'member', 'viewer'),
});

const updateMemberSchema = Joi.object({
  role: Joi.string().required().valid('admin', 'member', 'viewer'),
});

/**
 * POST /api/v1/tenant
 * Create a new tenant (System Admin only)
 * Requires: SSO session + System Admin role
 * Tenant admin email is mandatory
 */
router.post(
  '/',
  authenticateSSO,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createTenantSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const tenant = await TenantService_Instance.createTenant(value, userId);

      res.status(201).json({
        success: true,
        tenant,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant/:tenantId
 * Get tenant details
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/:tenantId',
  authenticateSSO,
  requireTenantMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;

      const tenant = await TenantService_Instance.getTenantById(tenantId);

      res.json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          memberCount: tenant.members.length,
          roleCount: tenant.roles.length,
          createdAt: tenant.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant
 * Get all tenants for current user
 * System admins see all tenants, regular users see only their tenants
 * Requires: SSO session
 */
router.get(
  '/',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const tenants = await TenantService_Instance.getUserTenants(userId);

      res.json({
        success: true,
        tenants,
        count: tenants.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tenant/:tenantId/members
 * Invite user to tenant (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 */
router.post(
  '/:tenantId/members',
  authenticateSSO,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = inviteMemberSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const { tenantId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const member = await TenantService_Instance.inviteTenantMember(tenantId, userId, value);

      res.status(201).json({
        success: true,
        member,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant/:tenantId/members
 * Get all members of a tenant
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/:tenantId/members',
  authenticateSSO,
  requireTenantMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;

      const members = await TenantService_Instance.getTenantMembers(tenantId);

      res.json({
        success: true,
        members,
        count: members.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/tenant/:tenantId/members/:memberId
 * Update member role (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 */
router.put(
  '/:tenantId/members/:memberId',
  authenticateSSO,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateMemberSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const { tenantId, memberId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const updated = await TenantService_Instance.updateMemberRole(
        tenantId,
        userId,
        memberId,
        value.role
      );

      res.json({
        success: true,
        member: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/tenant/:tenantId/members/:memberId
 * Remove member from tenant (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 */
router.delete(
  '/:tenantId/members/:memberId',
  authenticateSSO,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId, memberId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      await TenantService_Instance.removeMember(tenantId, userId, memberId);

      res.json({
        success: true,
        message: 'Member removed from tenant',
      });
    } catch (error) {
      next(error);
    }
  }
);
/**
 * PUT /api/v1/tenant/:tenantId
 * Update tenant details (Tenant Admin only)
 * Requires: SSO session + Admin role in tenant
 */
router.put(
  '/:tenantId',
  authenticateSSO,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const { displayName } = req.body;

      // TODO: Implement update tenant logic
      res.json({
        success: true,
        message: 'Tenant updated successfully',
        tenant: {
          tenantId,
          displayName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
