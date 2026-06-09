import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';

// Infrastructure — config
import { createRedisClient } from './RedisClient';

// Infrastructure — persistence/prisma
import { PrismaApplicationQueryService } from '../persistence/prisma/PrismaApplicationQueryService';
import { PrismaApplicationRepository } from '../persistence/prisma/PrismaApplicationRepository';
import { PrismaAppResourceQueryService } from '../persistence/prisma/PrismaAppResourceQueryService';
import { PrismaAuthCodeRepository } from '../persistence/prisma/PrismaAuthCodeRepository';
import { PrismaAuthEventsQueryService } from '../persistence/prisma/PrismaAuthEventsQueryService';
import { PrismaEmailVerificationRepository } from '../persistence/prisma/PrismaEmailVerificationRepository';
import { PrismaOtpRepository } from '../persistence/prisma/PrismaOtpRepository';
import { PrismaQueryRepository } from '../persistence/prisma/PrismaQueryRepository';
import { PrismaRefreshTokenRepository } from '../persistence/prisma/PrismaRefreshTokenRepository';
import { PrismaRoleQueryService } from '../persistence/prisma/PrismaRoleQueryService';
import { PrismaRoleRepository } from '../persistence/prisma/PrismaRoleRepository';
import { PrismaSessionRepository } from '../persistence/prisma/PrismaSessionRepository';
import { PrismaStatsQueryService } from '../persistence/prisma/PrismaStatsQueryService';
import { PrismaTenantQueryService } from '../persistence/prisma/PrismaTenantQueryService';
import { PrismaTenantRepository } from '../persistence/prisma/PrismaTenantRepository';
import { PrismaUserQueryService } from '../persistence/prisma/PrismaUserQueryService';
import { PrismaUserRepository } from '../persistence/prisma/PrismaUserRepository';

// Infrastructure — persistence/redis
import { RedisCacheService } from '../persistence/redis/RedisCacheService';
import { RedisKeyFactory } from '../persistence/redis/RedisKeyFactoryService';
import { TenantVersionService } from '../persistence/redis/TenantVersionService';

// Infrastructure — persistence/cached
import { ApplicationCachedRepository } from '../persistence/cached/ApplicationCachedRepository';
import { AuthCodeCachedRepository } from '../persistence/cached/AuthCodeCachedRepository';
import { EmailVerificationCachedRepository } from '../persistence/cached/EmailVerificationCachedRepository';
import { OtpCachedRepository } from '../persistence/cached/OtpCachedRepository';
import { RefreshTokenCachedRepository } from '../persistence/cached/RefreshTokenCachedRepository';
import { RoleCachedRepository } from '../persistence/cached/RoleCachedRepository';
import { SessionCachedRepository } from '../persistence/cached/SessionCachedRepository';
import { TenantCachedRepository } from '../persistence/cached/TenantCachedRepository';
import { UserCachedRepository } from '../persistence/cached/UserCachedRepository';

// Infrastructure — security
import { Argon2PasswordHasher } from '../security/Argon2PasswordHasher';
import { HmacSha256HashService } from '../security/HmacHashService';
import { JwksProvider } from '../security/JwksProvider';
import { JwtTokenService } from '../security/JwtTokenService';

// Infrastructure — external-services
import { PrismaAuditService } from '../external-services/audit/PrismaAuditService';
import { ResendEmailService } from '../external-services/email/ResendEmailService';
import { InMemoryEventBus } from '../external-services/events/InMemoryEventBus';
import { AppLogger } from '../logging/AppLogger';

// Application — use cases (auth)
import { AuthorizeUseCase } from '../../application/use-cases/auth/AuthorizeUseCase';
import { ExchangeCodeUseCase } from '../../application/use-cases/auth/ExchangeCodeUseCase';
import { GetSessionContextUseCase } from '../../application/use-cases/auth/GetSessionContextUseCase';
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase';
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/RefreshTokenUseCase';
import { VerifySessionUseCase } from '../../application/use-cases/auth/VerifySessionUseCase';
import { CreateAppSessionUseCase } from '../../application/use-cases/session/CreateAppSessionUseCase';
import { CreateTenantUseCase } from '../../application/use-cases/tenant/CreateTenantUseCase';
import { GetTenantPublicInfoUseCase } from '../../application/use-cases/tenant/GetTenantPublicInfoUseCase';
import { AddUserToTenantUseCase, ChangeUserRoleUseCase } from '../../application/use-cases/tenant/TenantMemberUseCase';
import { ForgotPasswordUseCase, ResetPasswordUseCase } from '../../application/use-cases/user/PasswordResetUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/user/RegisterUserUseCase';
import { ChangePasswordUseCase, UpdateUserProfileUseCase } from '../../application/use-cases/user/UpdateUserUseCase';
import { VerifyEmailUseCase } from '../../application/use-cases/user/VerifyEmailUseCase';

// Application — admin use cases
import { AdminApplicationUseCases } from '../../application/use-cases/admin/AdminApplicationUseCases';
import { AdminAppResourceUseCases } from '../../application/use-cases/admin/AdminAppResourceUseCases';
import { AdminRoleUseCases } from '../../application/use-cases/admin/AdminRoleUseCases';
import { AdminStatsUseCases } from '../../application/use-cases/admin/AdminStatsUseCases';
import { AdminTenantUseCases } from '../../application/use-cases/admin/AdminTenantUseCases';
import { AdminUserUseCases } from '../../application/use-cases/admin/AdminUserUseCases';
import { AuthEventsUseCases } from '../../application/use-cases/admin/AuthEventsUseCases';

// Infrastructure — controllers
import { AdminTenantController } from '../web/controllers/AdminTenantController';
import { AdminUserController } from '../web/controllers/AdminUserController';
import { ApplicationsController } from '../web/controllers/ApplicationsController';
import { ApplicationSyncController } from '../web/controllers/ApplicationSyncController';
import { AppResourceController } from '../web/controllers/AppResourceController';
import { AuthController } from '../web/controllers/AuthController';
import { MetadataController } from '../web/controllers/MetadataController';
import { PasswordController } from '../web/controllers/PasswordController';
import { RoleController } from '../web/controllers/RoleController';
import { StatsController } from '../web/controllers/StatsController';
import { TenantController } from '../web/controllers/TenantController';
import { UserController } from '../web/controllers/UserController';
import { UtilController } from '../web/controllers/UtilController';

// Infrastructure — auth middleware
import { createAuthMiddleware } from '../web/middleware/AuthMiddleware';

/**
 * Container
 * Manual dependency-injection container.
 * All dependencies are wired here — no {} as any stubs.
 * Add new use cases / services by following the existing pattern.
 */
export class Container {
  private instances = new Map<string, any>();
  private prisma: PrismaClient;
  private redis: Redis;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = createRedisClient();
    this.registerAll();
  }

  private registerAll(): void {
    // ── Key loader: accepts a file path (.pem) or a raw PEM string ───────────
    const loadKey = (envVar: string): string => {
      const value = process.env[envVar] ?? '';
      if (!value) return '';
      // If it looks like a file path (ends with .pem or starts with ./ / /)
      if (value.trim().endsWith('.pem') || value.trim().startsWith('/') || value.trim().startsWith('./')) {
        const resolved = path.resolve(process.cwd(), value.trim());
        return fs.readFileSync(resolved, 'utf8');
      }
      // Raw PEM string in env var — replace escaped \n with real newlines
      return value.replace(/\\n/g, '\n');
    };

    // ── External services ────────────────────────────────────────────────────
    const eventBus = new InMemoryEventBus();
    const auditService = new PrismaAuditService(this.prisma);
    const emailService = new ResendEmailService(
      process.env.RESEND_API_KEY ?? '',
      process.env.EMAIL_FROM ?? 'no-reply@bigso.co'
    );
    const cacheService = new RedisCacheService(this.redis);

    // ── Security ─────────────────────────────────────────────────────────────
    const passwordHasher = new Argon2PasswordHasher();
    const tokenService = new JwtTokenService(
      loadKey('JWT_PRIVATE_KEY'),
      loadKey('JWT_PUBLIC_KEY'),
      process.env.JWT_ISSUER ?? 'sso.bigso.co'
    );
    const hashService = new HmacSha256HashService(); // reads REFRESH_TOKEN_PEPPER from env
    const jwksProvider = new JwksProvider(loadKey('JWT_PRIVATE_KEY'));

    // ── Shared infrastructure for repositories ──────────────────────────
    const keyFactory = new RedisKeyFactory();
    const tenantVersions = new TenantVersionService(this.redis); // O(1) group invalidation
    const anyCache = () => new RedisCacheService<any>(this.redis);
    const strCache = () => new RedisCacheService<string>(this.redis);
    const strArrCache = () => new RedisCacheService<string[]>(this.redis);

    const userRepository = new UserCachedRepository(
      new PrismaUserRepository(this.prisma),
      anyCache(), strCache(), strArrCache(), keyFactory
    );
    const sessionRepository = new SessionCachedRepository(
      new PrismaSessionRepository(this.prisma),
      anyCache(), strArrCache(), keyFactory
    );
    const refreshTokenRepository = new RefreshTokenCachedRepository(
      new PrismaRefreshTokenRepository(this.prisma),
      anyCache(), strCache(), keyFactory
    );
    const tenantRepository = new TenantCachedRepository(
      new PrismaTenantRepository(this.prisma),
      anyCache(), strCache(), strArrCache(), keyFactory
    );
    const applicationRepository = new ApplicationCachedRepository(
      new PrismaApplicationRepository(this.prisma),
      anyCache(), strCache(), anyCache(), keyFactory
    );
    const authCodeRepository = new AuthCodeCachedRepository(
      new PrismaAuthCodeRepository(this.prisma),
      anyCache(), strCache(), keyFactory
    );
    const roleRepository = new RoleCachedRepository(
      new PrismaRoleRepository(this.prisma),
      anyCache(), strCache(), strArrCache(), keyFactory,
      tenantVersions  // ← O(1) group invalidation via INCR
    );
    const emailVerificationRepository = new EmailVerificationCachedRepository(
      new PrismaEmailVerificationRepository(this.prisma),
      anyCache(), strCache(), keyFactory
    );
    const otpRepository = new OtpCachedRepository(
      new PrismaOtpRepository(this.prisma),
      anyCache(), strCache(), keyFactory
    );

    const queryRepository = new PrismaQueryRepository(this.prisma);
    const userQueryService = new PrismaUserQueryService(this.prisma);
    const tenantQueryService = new PrismaTenantQueryService(this.prisma);
    const appQueryService = new PrismaApplicationQueryService(this.prisma);
    const roleQueryService = new PrismaRoleQueryService(this.prisma);
    const statsQueryService = new PrismaStatsQueryService(this.prisma);
    const authEventsQueryService = new PrismaAuthEventsQueryService(this.prisma);
    const appResourceQueryService = new PrismaAppResourceQueryService(this.prisma);

    // ── Application services ─────────────────────────────────────────────────
    // (SessionEnrichmentService eliminado — lógica movida a GetSessionContextUseCase)

    // ── Logger ───────────────────────────────────────────────────────────────
    const logger = new AppLogger('IdpCore');

    // ── Use cases ────────────────────────────────────────────────────────────
    const loginUseCase = new LoginUseCase(
      userRepository,
      sessionRepository,
      refreshTokenRepository,
      tokenService,
      auditService,
      eventBus,
      hashService,
      passwordHasher,
      logger
    );

    const logoutUseCase = new LogoutUseCase(
      sessionRepository,
      auditService,
      eventBus
    );

    const refreshTokenUseCase = new RefreshTokenUseCase(
      refreshTokenRepository,
      sessionRepository,
      tokenService,
      auditService,
      eventBus,
      hashService,
      queryRepository,
      logger
    );

    const registerUserUseCase = new RegisterUserUseCase(
      userRepository,
      tenantRepository,
      emailService,
      auditService,
      eventBus,
      passwordHasher
    );

    const createAppSessionUseCase = new CreateAppSessionUseCase(
      sessionRepository,
      userRepository,
      tenantRepository,
      tokenService,
      auditService,
      eventBus
    );

    const createTenantUseCase = new CreateTenantUseCase(
      tenantRepository,
      userRepository,
      auditService,
      eventBus
    );

    const verifySessionUseCase = new VerifySessionUseCase(
      sessionRepository,
      tokenService,
      auditService
    );

    const exchangeCodeUseCase = new ExchangeCodeUseCase(
      authCodeRepository,
      sessionRepository,
      userRepository,
      refreshTokenRepository,
      tokenService,
      auditService,
      eventBus,
      hashService,
      queryRepository,
      logger
    );

    const authorizeUseCase = new AuthorizeUseCase(
      authCodeRepository,
      applicationRepository,
      tenantRepository,
      userRepository,
      sessionRepository,
      tokenService,
      auditService
    );

    const updateProfileUseCase = new UpdateUserProfileUseCase(
      userRepository,
      auditService,
      eventBus
    );

    const getSessionContextUseCase = new GetSessionContextUseCase(
      sessionRepository,
      queryRepository,
      tokenService,
      auditService
    );

    const changePasswordUseCase = new ChangePasswordUseCase(
      userRepository,
      auditService,
      eventBus,
      passwordHasher
    );

    const verifyEmailUseCase = new VerifyEmailUseCase(
      emailVerificationRepository,
      userRepository,
      emailService,
      auditService,
      eventBus
    );

    const addUserToTenantUseCase = new AddUserToTenantUseCase(
      tenantRepository,
      userRepository,
      queryRepository,
      auditService,
      eventBus
    );

    const changeUserRoleUseCase = new ChangeUserRoleUseCase(
      tenantRepository,
      userRepository,
      queryRepository,
      auditService,
      eventBus
    );

    const forgotPasswordUseCase = new ForgotPasswordUseCase(
      userRepository,
      emailVerificationRepository,
      emailService,
      auditService
    );

    const resetPasswordUseCase = new ResetPasswordUseCase(
      userRepository,
      emailVerificationRepository,
      auditService,
      eventBus,
      passwordHasher
    );

    const getTenantPublicInfoUseCase = new GetTenantPublicInfoUseCase(tenantRepository);

    // ── Register in map ──────────────────────────────────────────────────────
    this.instances.set('PrismaClient', this.prisma);
    this.instances.set('RedisClient', this.redis);

    this.instances.set('ILogger', logger);
    this.instances.set('IEventBus', eventBus);
    this.instances.set('IAuditService', auditService);
    this.instances.set('IEmailService', emailService);
    this.instances.set('ICacheService', cacheService);
    this.instances.set('IPasswordHasher', passwordHasher);
    this.instances.set('ITokenService', tokenService);
    this.instances.set('IHashService', hashService);
    this.instances.set('JwksProvider', jwksProvider);

    this.instances.set('IUserRepository', userRepository);
    this.instances.set('ISessionRepository', sessionRepository);
    this.instances.set('IRefreshTokenRepository', refreshTokenRepository);
    this.instances.set('ITenantRepository', tenantRepository);
    this.instances.set('IApplicationRepository', applicationRepository);
    this.instances.set('IAuthCodeRepository', authCodeRepository);
    this.instances.set('IRoleRepository', roleRepository);
    this.instances.set('IEmailVerificationRepository', emailVerificationRepository);
    this.instances.set('IOtpRepository', otpRepository);
    this.instances.set('IQueryRepository', queryRepository);

    this.instances.set('LoginUseCase', loginUseCase);
    this.instances.set('LogoutUseCase', logoutUseCase);
    this.instances.set('RefreshTokenUseCase', refreshTokenUseCase);
    this.instances.set('RegisterUserUseCase', registerUserUseCase);
    this.instances.set('CreateAppSessionUseCase', createAppSessionUseCase);
    this.instances.set('CreateTenantUseCase', createTenantUseCase);

    this.instances.set('VerifySessionUseCase', verifySessionUseCase);
    this.instances.set('ExchangeCodeUseCase', exchangeCodeUseCase);
    this.instances.set('AuthorizeUseCase', authorizeUseCase);
    this.instances.set('UpdateUserProfileUseCase', updateProfileUseCase);
    this.instances.set('GetSessionContextUseCase', getSessionContextUseCase);
    this.instances.set('ChangePasswordUseCase', changePasswordUseCase);
    this.instances.set('VerifyEmailUseCase', verifyEmailUseCase);
    this.instances.set('AddUserToTenantUseCase', addUserToTenantUseCase);
    this.instances.set('ChangeUserRoleUseCase', changeUserRoleUseCase);
    this.instances.set('ForgotPasswordUseCase', forgotPasswordUseCase);
    this.instances.set('ResetPasswordUseCase', resetPasswordUseCase);
    this.instances.set('GetTenantPublicInfoUseCase', getTenantPublicInfoUseCase);

    // ── Admin use cases (all use injected QueryServices, zero src/ imports) ───
    const adminUsers = new AdminUserUseCases(userQueryService);
    const adminTenants = new AdminTenantUseCases(tenantQueryService, userQueryService);
    const adminApplications = new AdminApplicationUseCases(appQueryService);
    const adminRoles = new AdminRoleUseCases(roleQueryService);
    const adminStats = new AdminStatsUseCases(statsQueryService);
    const authEvents = new AuthEventsUseCases(authEventsQueryService, userQueryService);
    const adminAppResources = new AdminAppResourceUseCases(appResourceQueryService);

    this.instances.set('AdminUserUseCases', adminUsers);
    this.instances.set('AdminTenantUseCases', adminTenants);
    this.instances.set('AdminApplicationUseCases', adminApplications);
    this.instances.set('AdminRoleUseCases', adminRoles);
    this.instances.set('AdminStatsUseCases', adminStats);
    this.instances.set('AuthEventsUseCases', authEvents);
    this.instances.set('AdminAppResourceUseCases', adminAppResources);

    // ── Admin controllers ─────────────────────────────────────────────────────
    this.instances.set('AdminUserController', new AdminUserController(adminUsers));
    this.instances.set('AdminTenantController', new AdminTenantController(adminTenants));
    this.instances.set('RoleController', new RoleController(adminRoles));
    this.instances.set('ApplicationsController', new ApplicationsController(adminApplications));
    this.instances.set('ApplicationSyncController', new ApplicationSyncController(appQueryService, adminAppResources));
    this.instances.set('StatsController', new StatsController(adminStats, authEvents));
    this.instances.set('AppResourceController', new AppResourceController(adminAppResources));
    this.instances.set('UtilController', new UtilController());
    this.instances.set('MetadataController', new MetadataController());

    // ── Controllers ──────────────────────────────────────────────────────────
    const authController = new AuthController(
      loginUseCase,
      logoutUseCase,
      refreshTokenUseCase,
      exchangeCodeUseCase,
      authorizeUseCase,
      getSessionContextUseCase
    );
    const userController = new UserController(
      registerUserUseCase,
      updateProfileUseCase,
      changePasswordUseCase,
      verifyEmailUseCase
    );
    const tenantController = new TenantController(
      createTenantUseCase,
      addUserToTenantUseCase,
      changeUserRoleUseCase,
      getTenantPublicInfoUseCase
    );
    const passwordController = new PasswordController(
      forgotPasswordUseCase,
      resetPasswordUseCase
    );

    this.instances.set('AuthController', authController);
    this.instances.set('UserController', userController);
    this.instances.set('TenantController', tenantController);
    this.instances.set('PasswordController', passwordController);

    // ── Auth middleware factory ───────────────────────────────────────────────
    this.instances.set('RequireAuth', createAuthMiddleware(verifySessionUseCase));
  }

  async initialize(): Promise<void> {
    const jwksProvider = this.get<JwksProvider>('JwksProvider');
    await jwksProvider.initialize();
  }

  get<T>(token: string): T {
    const instance = this.instances.get(token);
    if (!instance) {
      throw new Error(`[Container] No instance registered for token: ${token}`);
    }
    return instance as T;
  }

  async dispose(): Promise<void> {
    await this.prisma.$disconnect();
    await this.redis.quit();
  }
}
