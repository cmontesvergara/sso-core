import { Router } from 'express';
import { Container } from '../../config/Container';
import { AuthController } from '../controllers/AuthController';
import { UserController } from '../controllers/UserController';
import { TenantController } from '../controllers/TenantController';
import { PasswordController } from '../controllers/PasswordController';
import { VerifySessionUseCase } from '../../../application/use-cases/auth/VerifySessionUseCase';
import { GetSessionContextUseCase } from '../../../application/use-cases/auth/GetSessionContextUseCase';
import { ExchangeCodeUseCase } from '../../../application/use-cases/auth/ExchangeCodeUseCase';
import { AuthorizeUseCase } from '../../../application/use-cases/auth/AuthorizeUseCase';
import { SessionEnrichmentService } from '../../../application/services/SessionEnrichmentService';
import { UpdateUserProfileUseCase, ChangePasswordUseCase } from '../../../application/use-cases/user/UpdateUserUseCase';
import { VerifyEmailUseCase } from '../../../application/use-cases/user/VerifyEmailUseCase';
import { ForgotPasswordUseCase, ResetPasswordUseCase } from '../../../application/use-cases/user/PasswordResetUseCase';
import { AddUserToTenantUseCase, ChangeUserRoleUseCase } from '../../../application/use-cases/tenant/TenantMemberUseCase';

import { RoleController } from '../controllers/RoleController';
import { ApplicationsController } from '../controllers/ApplicationsController';
import { AppResourceController } from '../controllers/AppResourceController';
import { MetadataController } from '../controllers/MetadataController';
import { ApplicationSyncController } from '../controllers/ApplicationSyncController';
import { StatsController } from '../controllers/StatsController';
import { UtilController } from '../controllers/UtilController';
import { AdminUserController } from '../controllers/AdminUserController';
import { AdminTenantController } from '../controllers/AdminTenantController';

import { createRoleRouter } from './role.routes';
import { createApplicationsRouter } from './applications.routes';
import { createAppResourceRouter } from './appResource.routes';
import { createMetadataRouter } from './metadata.routes';
import { createApplicationSyncRouter } from './applicationSync.routes';
import { createStatsRouter } from './stats.routes';
import { createUtilRouter } from './util.routes';
import { createAdminUserRouter } from './adminUser.routes';
import { createAdminTenantRouter } from './adminTenant.routes';
import { createAuthMiddleware } from '../middleware/AuthMiddleware';
import {
  validateLogin,
  validateRefresh,
  validateExchange,
  validateAuthorize,
  validateRegister,
} from '../middleware/ValidationMiddleware';

/**
 * createRouter
 * Wires all /api/v3 routes from the Container.
 * The resulting Router is mounted on /api/v3 in Server.ts.
 */
export function createRouter(container: Container): Router {
  const router = Router();

  // ── Resolve use cases not yet in Container ───────────────────────────────
  const verifySessionUseCase = new VerifySessionUseCase(
    container.get('ISessionRepository'),
    container.get('ITokenService'),
    container.get('IAuditService')
  );

  const exchangeCodeUseCase = new ExchangeCodeUseCase(
    container.get('IAuthCodeRepository'),
    container.get('ISessionRepository'),
    container.get('IUserRepository'),
    container.get('IRefreshTokenRepository'),
    container.get('ITokenService'),
    container.get('IAuditService'),
    container.get('IEventBus'),
    container.get('IHashService'),
    container.get('PrismaClient'),
    container.get<SessionEnrichmentService>('SessionEnrichmentService')
  );

  const authorizeUseCase = new AuthorizeUseCase(
    container.get('IAuthCodeRepository'),
    container.get('IApplicationRepository'),
    container.get('ITenantRepository'),
    container.get('IUserRepository'),
    container.get('ISessionRepository'),
    container.get('ITokenService'),
    container.get('IAuditService')
  );

  const updateProfileUseCase = new UpdateUserProfileUseCase(
    container.get('IUserRepository'),
    container.get('IAuditService'),
    container.get('IEventBus')
  );

  const getSessionContextUseCase = new GetSessionContextUseCase(
    container.get('ISessionRepository'),
    container.get('PrismaClient'),
    container.get('ITokenService'),
    container.get<SessionEnrichmentService>('SessionEnrichmentService'),
    container.get('IAuditService')
  );

  const changePasswordUseCase = new ChangePasswordUseCase(
    container.get('IUserRepository'),
    container.get('IAuditService'),
    container.get('IEventBus'),
    container.get('IPasswordHasher')
  );

  const verifyEmailUseCase = new VerifyEmailUseCase(
    container.get('IEmailVerificationRepository'),
    container.get('IUserRepository'),
    container.get('IEmailService'),
    container.get('IAuditService'),
    container.get('IEventBus')
  );

  const addUserToTenantUseCase = new AddUserToTenantUseCase(
    container.get('ITenantRepository'),
    container.get('IUserRepository'),
    container.get('PrismaClient'),
    container.get('IAuditService'),
    container.get('IEventBus')
  );

  const changeUserRoleUseCase = new ChangeUserRoleUseCase(
    container.get('ITenantRepository'),
    container.get('IUserRepository'),
    container.get('PrismaClient'),
    container.get('IAuditService'),
    container.get('IEventBus')
  );

  const forgotPasswordUseCase = new ForgotPasswordUseCase(
    container.get('IUserRepository'),
    container.get('IEmailVerificationRepository'),
    container.get('IEmailService'),
    container.get('IAuditService')
  );

  const resetPasswordUseCase = new ResetPasswordUseCase(
    container.get('IUserRepository'),
    container.get('IEmailVerificationRepository'),
    container.get('IAuditService'),
    container.get('IEventBus'),
    container.get('IPasswordHasher')
  );

  // ── Controllers ──────────────────────────────────────────────────────────
  const authController = new AuthController(
    container.get('LoginUseCase'),
    container.get('LogoutUseCase'),
    container.get('RefreshTokenUseCase'),
    exchangeCodeUseCase,
    authorizeUseCase,
    getSessionContextUseCase
  );

  const userController = new UserController(
    container.get('RegisterUserUseCase'),
    updateProfileUseCase,
    changePasswordUseCase,
    verifyEmailUseCase
  );

  const tenantController = new TenantController(
    container.get('CreateTenantUseCase'),
    addUserToTenantUseCase,
    changeUserRoleUseCase
  );

  const passwordController = new PasswordController(
    forgotPasswordUseCase,
    resetPasswordUseCase
  );

  const roleController            = container.get<RoleController>('RoleController');
  const applicationsController    = container.get<ApplicationsController>('ApplicationsController');
  const appResourceController     = container.get<AppResourceController>('AppResourceController');
  const metadataController        = container.get<MetadataController>('MetadataController');
  const applicationSyncController = container.get<ApplicationSyncController>('ApplicationSyncController');
  const statsController           = container.get<StatsController>('StatsController');
  const utilController            = container.get<UtilController>('UtilController');
  const userLegacyController      = container.get<AdminUserController>('AdminUserController');
  const tenantLegacyController    = container.get<AdminTenantController>('TenantController');

  // ── Auth middleware ───────────────────────────────────────────────────────
  const requireAuth = createAuthMiddleware(verifySessionUseCase);

  // ── Public routes (no auth required) ─────────────────────────────────────────
  router.post('/auth/login',           validateLogin,    authController.login);
  router.post('/auth/refresh',          validateRefresh,  authController.refresh);
  router.post('/auth/exchange',         validateExchange, authController.exchange);
  router.post('/auth/session',          authController.session);
  router.post('/auth/forgot-password',  passwordController.forgotPassword);
  router.post('/auth/reset-password',   passwordController.resetPassword);
  router.post('/users/register',        validateRegister, userController.register);
  router.get('/users/verify-email',     userController.verifyEmail);

  // ── Protected routes ──────────────────────────────────────────────────────
  router.post('/auth/logout',           requireAuth, authController.logout);
  router.post('/auth/authorize',        requireAuth, validateAuthorize, authController.authorize);

  router.patch('/users/profile',        requireAuth, userController.updateProfile);
  router.post('/users/change-password', requireAuth, userController.changePassword);
  router.post('/users/send-verification', requireAuth, userController.sendVerification);

  router.post('/tenants',               requireAuth, tenantController.createTenant);
  router.post('/tenants/:tenantId/members',                requireAuth, tenantController.addMember);
  router.patch('/tenants/:tenantId/members/:userId/role',  requireAuth, tenantController.changeRole);

  // ── Migrated v1 routes (Legacy integrations) ───────────────────────────────
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
