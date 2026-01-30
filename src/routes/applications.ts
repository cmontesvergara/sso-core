import { NextFunction, Response, Router } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { requireSuperAdmin, requireSystemAdmin } from '../middleware/ssoSystemAdmin';
import {
    appIdExists,
    createApplication,
    findApplicationById,
    listApplications,
    softDeleteApplication,
    updateApplication,
} from '../repositories/applicationRepo.prisma';
import {
    enableAppForTenant,
    findTenantApp,
    listTenantApps,
    removeAppFromTenant,
} from '../repositories/tenantAppRepo.prisma';
import { findTenantMember } from '../repositories/tenantRepo.prisma';
import {
    grantBulkAppAccess,
    grantUserAppAccess,
    listUserAppsInTenant,
    listUsersWithAppAccess,
    revokeAllAccessToAppInTenant,
    revokeUserAppAccess,
    userHasAppAccess,
} from '../repositories/userAppAccessRepo.prisma';

const router = Router();

/**
 * Validation schemas
 */
const createApplicationSchema = Joi.object({
  appId: Joi.string()
    .required()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/),
  name: Joi.string().required().min(3).max(100),
  url: Joi.string().required().uri(),
  description: Joi.string().optional().max(500),
  logoUrl: Joi.string().optional().allow('', null),
});

const updateApplicationSchema = Joi.object({
  name: Joi.string().optional().min(3).max(100),
  url: Joi.string().optional().uri(),
  description: Joi.string().optional().max(500).allow('', null),
  logoUrl: Joi.string().optional().allow('', null),
  isActive: Joi.boolean().optional(),
});

const enableAppForTenantSchema = Joi.object({
  applicationId: Joi.string().required().uuid(),
  config: Joi.object().optional(),
});

const grantAccessSchema = Joi.object({
  userId: Joi.string().required().uuid(),
});

const grantBulkAccessSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).required().min(1),
});

/**
 * ==========================================
 * APPLICATION CRUD (Admin only)
 * ==========================================
 */

/**
 * POST /api/v1/applications
 * Create a new application (system-wide)
 * Requires: SSO session + System Admin role
 */
router.post(
  '/',
  authenticateSSO,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = createApplicationSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      // Check if appId already exists
      const exists = await appIdExists(value.appId);
      if (exists) {
        throw new AppError(409, 'Application ID already exists', 'APP_ID_EXISTS');
      }

      const application = await createApplication(value);

      res.status(201).json({
        success: true,
        application,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/applications
 * List all applications
 * Requires: SSO session + System Admin role
 */
router.get(
  '/',
  authenticateSSO,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const activeOnly = req.query.active === 'true';
      const applications = await listApplications({ activeOnly });

      res.json({
        success: true,
        applications,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/applications/:id
 * Get application by ID
 * Requires: SSO session + System Admin role
 */
router.get(
  '/:id',
  authenticateSSO,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const application = await findApplicationById(req.params.id);

      if (!application) {
        throw new AppError(404, 'Application not found', 'NOT_FOUND');
      }

      res.json({
        success: true,
        application,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/applications/:id
 * Update application
 * Requires: SSO session + System Admin role
 */
router.put(
  '/:id',
  authenticateSSO,
  requireSystemAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = updateApplicationSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const exists = await findApplicationById(req.params.id);
      if (!exists) {
        throw new AppError(404, 'Application not found', 'NOT_FOUND');
      }

      const application = await updateApplication(req.params.id, value);

      res.json({
        success: true,
        application,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/applications/:id
 * Soft delete application (set isActive = false)
 * Requires: SSO session + Super Admin role
 */
router.delete(
  '/:id',
  authenticateSSO,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const exists = await findApplicationById(req.params.id);
      if (!exists) {
        throw new AppError(404, 'Application not found', 'NOT_FOUND');
      }

      await softDeleteApplication(req.params.id);

      res.json({
        success: true,
        message: 'Application deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * ==========================================
 * TENANT APP MANAGEMENT
 * ==========================================
 */

/**
 * POST /api/v1/applications/tenant/:tenantId/enable
 * Enable an application for a tenant
 * Requires: Auth token + Admin role in tenant
 */
router.post(
  '/tenant/:tenantId/enable',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can enable applications', 'FORBIDDEN');
      }

      const { error, value } = enableAppForTenantSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      // Check if application exists
      const application = await findApplicationById(value.applicationId);
      if (!application) {
        throw new AppError(404, 'Application not found', 'NOT_FOUND');
      }

      // Check if already enabled
      const existing = await findTenantApp(tenantId, value.applicationId);
      if (existing) {
        throw new AppError(409, 'Application already enabled for this tenant', 'ALREADY_ENABLED');
      }

      const tenantApp = await enableAppForTenant({
        tenantId,
        applicationId: value.applicationId,
        config: value.config,
      });

      res.status(201).json({
        success: true,
        tenantApp,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/applications/tenant/:tenantId
 * List all applications enabled for a tenant
 * Requires: Auth token + Member in tenant
 */
router.get(
  '/tenant/:tenantId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is member of tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member) {
        throw new AppError(403, 'Access denied to tenant', 'FORBIDDEN');
      }

      const tenantApps = await listTenantApps(tenantId, true);

      res.json({
        success: true,
        applications: tenantApps,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/applications/tenant/:tenantId/:applicationId
 * Remove application from tenant
 * Requires: Auth token + Admin role in tenant
 */
router.delete(
  '/tenant/:tenantId/:applicationId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can remove applications', 'FORBIDDEN');
      }

      // Check if app is enabled for tenant
      const tenantApp = await findTenantApp(tenantId, applicationId);
      if (!tenantApp) {
        throw new AppError(404, 'Application not enabled for this tenant', 'NOT_FOUND');
      }

      // Remove all user access to this app in this tenant
      await revokeAllAccessToAppInTenant(tenantId, applicationId);

      // Remove app from tenant
      await removeAppFromTenant(tenantId, applicationId);

      res.json({
        success: true,
        message: 'Application removed from tenant successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * ==========================================
 * USER APP ACCESS MANAGEMENT
 * ==========================================
 */

/**
 * POST /api/v1/applications/tenant/:tenantId/:applicationId/grant
 * Grant a user access to an application in a tenant
 * Requires: Auth token + Admin role in tenant
 */
router.post(
  '/tenant/:tenantId/:applicationId/grant',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can grant app access', 'FORBIDDEN');
      }

      const { error, value } = grantAccessSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      // Verify application is enabled for tenant
      const tenantApp = await findTenantApp(tenantId, applicationId);
      if (!tenantApp || !tenantApp.isEnabled) {
        throw new AppError(404, 'Application not enabled for this tenant', 'NOT_FOUND');
      }

      // Verify target user is member of tenant
      const targetMember = await findTenantMember(tenantId, value.userId);
      if (!targetMember) {
        throw new AppError(404, 'User is not a member of this tenant', 'NOT_FOUND');
      }

      // Check if already has access
      const hasAccess = await userHasAppAccess(value.userId, tenantId, applicationId);
      if (hasAccess) {
        throw new AppError(
          409,
          'User already has access to this application',
          'ALREADY_HAS_ACCESS'
        );
      }

      const access = await grantUserAppAccess({
        userId: value.userId,
        tenantId,
        applicationId,
        grantedBy: userId,
      });

      res.status(201).json({
        success: true,
        access,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/applications/tenant/:tenantId/:applicationId/grant-bulk
 * Grant multiple users access to an application in a tenant
 * Requires: Auth token + Admin role in tenant
 */
router.post(
  '/tenant/:tenantId/:applicationId/grant-bulk',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can grant app access', 'FORBIDDEN');
      }

      const { error, value } = grantBulkAccessSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      // Verify application is enabled for tenant
      const tenantApp = await findTenantApp(tenantId, applicationId);
      if (!tenantApp || !tenantApp.isEnabled) {
        throw new AppError(404, 'Application not enabled for this tenant', 'NOT_FOUND');
      }

      // Prepare grants
      const grants = value.userIds.map((uid: string) => ({
        userId: uid,
        tenantId,
        applicationId,
        grantedBy: userId,
      }));

      const count = await grantBulkAppAccess(grants);

      res.status(201).json({
        success: true,
        message: `Granted access to ${count} users`,
        count,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/applications/tenant/:tenantId/:applicationId/revoke/:userId
 * Revoke a user's access to an application in a tenant
 * Requires: Auth token + Admin role in tenant
 */
router.delete(
  '/tenant/:tenantId/:applicationId/revoke/:userId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId, userId: targetUserId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can revoke app access', 'FORBIDDEN');
      }

      await revokeUserAppAccess(targetUserId, tenantId, applicationId);

      res.json({
        success: true,
        message: 'Access revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/applications/tenant/:tenantId/:applicationId/users
 * List all users with access to an application in a tenant
 * Requires: Auth token + Admin role in tenant
 */
router.get(
  '/tenant/:tenantId/:applicationId/users',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is admin in tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member || member.role !== 'admin') {
        throw new AppError(403, 'Only tenant admins can view app access', 'FORBIDDEN');
      }

      const users = await listUsersWithAppAccess(tenantId, applicationId);

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/applications/user/:tenantId
 * List all applications the authenticated user has access to in a tenant
 * Requires: Auth token + Member in tenant
 */
router.get(
  '/user/:tenantId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      // Verify user is member of tenant
      const member = await findTenantMember(tenantId, userId);
      if (!member) {
        throw new AppError(403, 'Access denied to tenant', 'FORBIDDEN');
      }

      const apps = await listUserAppsInTenant(userId, tenantId);

      res.json({
        success: true,
        applications: apps,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
