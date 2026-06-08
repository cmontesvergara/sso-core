import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Container } from '../../config/Container';
import { AuthController } from '../controllers/AuthController';
import { PasswordController } from '../controllers/PasswordController';
import { TenantController } from '../controllers/TenantController';
import { UserController } from '../controllers/UserController';

import { AdminTenantController } from '../controllers/AdminTenantController';
import { AdminUserController } from '../controllers/AdminUserController';
import { ApplicationsController } from '../controllers/ApplicationsController';
import { ApplicationSyncController } from '../controllers/ApplicationSyncController';
import { AppResourceController } from '../controllers/AppResourceController';
import { MetadataController } from '../controllers/MetadataController';
import { RoleController } from '../controllers/RoleController';
import { StatsController } from '../controllers/StatsController';
import { UtilController } from '../controllers/UtilController';

import { createAuthMiddleware } from '../middleware/AuthMiddleware';
import {
  validateAuthorize,
  validateExchange,
  validateLogin,
  validateRefresh,
  validateRegister,
} from '../middleware/ValidationMiddleware';
import { createAdminTenantRouter } from './adminTenant.routes';
import { createAdminUserRouter } from './adminUser.routes';
import { createApplicationsRouter } from './applications.routes';
import { createApplicationSyncRouter } from './applicationSync.routes';
import { createAppResourceRouter } from './appResource.routes';
import { createMetadataRouter } from './metadata.routes';
import { createRoleRouter } from './role.routes';
import { createStatsRouter } from './stats.routes';
import { createUtilRouter } from './util.routes';

/**
 * createRouter
 * Wires all /api/v2 routes from the Container.
 * The resulting Router is mounted on /api/v2 in Server.ts.
 */
export function createRouter(container: Container): Router {
  const router = Router();

  // ── Resolve all controllers from Container ───────────────────────────────
  const authController = container.get<AuthController>('AuthController');
  const userController = container.get<UserController>('UserController');
  const tenantController = container.get<TenantController>('TenantController');
  const passwordController = container.get<PasswordController>('PasswordController');

  const roleController = container.get<RoleController>('RoleController');
  const applicationsController = container.get<ApplicationsController>('ApplicationsController');
  const appResourceController = container.get<AppResourceController>('AppResourceController');
  const metadataController = container.get<MetadataController>('MetadataController');
  const applicationSyncController = container.get<ApplicationSyncController>('ApplicationSyncController');
  const statsController = container.get<StatsController>('StatsController');
  const utilController = container.get<UtilController>('UtilController');
  const userLegacyController = container.get<AdminUserController>('AdminUserController');
  const tenantLegacyController = container.get<AdminTenantController>('AdminTenantController');

  // ── Auth middleware ───────────────────────────────────────────────────────
  const requireAuth = createAuthMiddleware(container.get('VerifySessionUseCase'));

  // ── Rate limiters ─────────────────────────────────────────────────────────
  const sendVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each IP to 3 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Has excedido el límite de reenvíos. Intenta de nuevo más tarde.' },
  });

  const tenantInfoLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 60, // Limit each IP to 60 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests for tenant info. Please try again later.' },
  });

  // ── Public routes (no auth required) ─────────────────────────────────────────
  router.post('/auth/login', validateLogin, authController.login);
  router.post('/auth/refresh', validateRefresh, authController.refresh);
  router.post('/auth/exchange', validateExchange, authController.exchange);
  router.post('/auth/session', authController.session);
  router.post('/auth/forgot-password', passwordController.forgotPassword);
  router.post('/auth/reset-password', passwordController.resetPassword);
  router.post('/users/register', validateRegister, userController.register);
  router.post('/users/verify-email', userController.verifyEmail);
  router.post('/users/send-verification', sendVerificationLimiter, userController.sendVerification);
  router.get('/tenants/:tenantId/info', tenantInfoLimiter, tenantController.getPublicInfo);

  // ── Protected routes ──────────────────────────────────────────────────────
  router.post('/auth/logout', requireAuth, authController.logout);
  router.post('/auth/authorize', requireAuth, validateAuthorize, authController.authorize);

  router.patch('/users/profile', requireAuth, userController.updateProfile);
  router.post('/users/change-password', requireAuth, userController.changePassword);

  router.post('/tenants', requireAuth, tenantController.createTenant);
  router.post('/tenants/:tenantId/members', requireAuth, tenantController.addMember);
  router.patch('/tenants/:tenantId/members/:userId/role', requireAuth, tenantController.changeRole);

  // ── Admin / management routes ─────────────────────────────────────────────
  router.use('/role', createRoleRouter(roleController, requireAuth));
  router.use('/applications', createApplicationsRouter(applicationsController, requireAuth));
  router.use('/app-resources', createAppResourceRouter(appResourceController, requireAuth));
  router.use('/metadata', createMetadataRouter(metadataController, requireAuth));
  router.use('/applications', createApplicationSyncRouter(applicationSyncController, requireAuth));
  router.use('/stats', createStatsRouter(statsController, requireAuth));
  router.use('/util', createUtilRouter(utilController, requireAuth));

  // Expose remaining legacy endpoints under different paths or same paths
  router.use('/user', createAdminUserRouter(userLegacyController, requireAuth));
  router.use('/tenant', createAdminTenantRouter(tenantLegacyController, requireAuth));

  return router;
}
