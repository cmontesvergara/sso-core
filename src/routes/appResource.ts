import { NextFunction, Response, Router } from 'express';
import * as Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { appResourceService } from '../services/appResource';

const router = Router();

/**
 * Validation schemas
 */
const registerAppResourcesSchema = Joi.object({
  appId: Joi.string().required().min(2).max(50),
  resources: Joi.array()
    .items(
      Joi.object({
        resource: Joi.string().required().min(2).max(100),
        action: Joi.string().required().min(2).max(100),
        category: Joi.string().optional().max(50),
        description: Joi.string().optional().max(500),
      })
    )
    .required()
    .min(1),
});

/**
 * POST /api/v1/app-resources
 * Register or update resources for an application
 * This endpoint is typically called by applications during startup/deployment
 * Requires: SSO session (system should validate app credentials)
 *
 * Body: {
 *   appId: string,
 *   resources: Array<{ resource: string, action: string, category?: string, description?: string }>
 * }
 */
router.post(
  '/',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = registerAppResourcesSchema.validate(req.body);
      if (error) {
        throw new AppError(400, error.details[0].message, 'VALIDATION_ERROR');
      }

      const result = await appResourceService.registerAppResources(value);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/app-resources/:appId
 * Get all resources for a specific application
 * Requires: SSO session
 */
router.get(
  '/:appId',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { appId } = req.params;

      const resources = await appResourceService.getAppResources(appId);

      res.json({
        success: true,
        resources,
        count: resources.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/app-resources/tenant/:tenantId/available
 * Get all available resources for a tenant
 * Returns resources from all apps enabled for the tenant
 * Requires: SSO session + Member of tenant
 */
router.get(
  '/tenant/:tenantId/available',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const userId = req.ssoUser?.userId;

      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }

      const resources = await appResourceService.getAvailableResourcesForTenant(tenantId, userId);

      res.json({
        success: true,
        resources,
        count: resources.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
