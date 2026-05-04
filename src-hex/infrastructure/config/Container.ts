import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

// Infrastructure — config
import { createRedisClient } from './RedisClient';

// Infrastructure — persistence/prisma
import { PrismaUserRepository } from '../persistence/prisma/PrismaUserRepository';
import { PrismaSessionRepository } from '../persistence/prisma/PrismaSessionRepository';
import { PrismaRefreshTokenRepository } from '../persistence/prisma/PrismaRefreshTokenRepository';
import { PrismaTenantRepository } from '../persistence/prisma/PrismaTenantRepository';
import { PrismaApplicationRepository } from '../persistence/prisma/PrismaApplicationRepository';
import { PrismaAuthCodeRepository } from '../persistence/prisma/PrismaAuthCodeRepository';
import { PrismaRoleRepository } from '../persistence/prisma/PrismaRoleRepository';
import { PrismaEmailVerificationRepository } from '../persistence/prisma/PrismaEmailVerificationRepository';
import { PrismaOtpRepository } from '../persistence/prisma/PrismaOtpRepository';

// Infrastructure — persistence/redis
import { RedisCacheService } from '../persistence/redis/RedisCacheService';
import { RedisKeyFactory } from '../persistence/redis/RedisKeyFactoryService';
import { TenantVersionService } from '../persistence/redis/TenantVersionService';

// Infrastructure — persistence/cached
import { UserCachedRepository } from '../persistence/cached/UserCachedRepository';
import { SessionCachedRepository } from '../persistence/cached/SessionCachedRepository';
import { TenantCachedRepository } from '../persistence/cached/TenantCachedRepository';
import { ApplicationCachedRepository } from '../persistence/cached/ApplicationCachedRepository';
import { RoleCachedRepository } from '../persistence/cached/RoleCachedRepository';
import { RefreshTokenCachedRepository } from '../persistence/cached/RefreshTokenCachedRepository';
import { AuthCodeCachedRepository } from '../persistence/cached/AuthCodeCachedRepository';
import { EmailVerificationCachedRepository } from '../persistence/cached/EmailVerificationCachedRepository';
import { OtpCachedRepository } from '../persistence/cached/OtpCachedRepository';

// Infrastructure — security
import { JwtTokenService } from '../security/JwtTokenService';
import { Argon2PasswordHasher } from '../security/Argon2PasswordHasher';
import { HmacSha256HashService } from '../security/HmacHashService';
import { JwksProvider } from '../security/JwksProvider';

// Infrastructure — external-services
import { InMemoryEventBus } from '../external-services/events/InMemoryEventBus';
import { PrismaAuditService } from '../external-services/audit/PrismaAuditService';
import { ResendEmailService } from '../external-services/email/ResendEmailService';

// Application — use cases (auth)
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase';
import { LogoutUseCase } from '../../application/use-cases/auth/LogoutUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/RefreshTokenUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/user/RegisterUserUseCase';
import { CreateAppSessionUseCase } from '../../application/use-cases/session/CreateAppSessionUseCase';
import { CreateTenantUseCase } from '../../application/use-cases/tenant/CreateTenantUseCase';

// Application — admin use cases
import { AdminUserUseCases } from '../../application/use-cases/admin/AdminUserUseCases';
import { AdminTenantUseCases } from '../../application/use-cases/admin/AdminTenantUseCases';
import { AdminApplicationUseCases } from '../../application/use-cases/admin/AdminApplicationUseCases';
import { AdminRoleUseCases } from '../../application/use-cases/admin/AdminRoleUseCases';
import { AdminStatsUseCases } from '../../application/use-cases/admin/AdminStatsUseCases';
import { AdminAppResourceUseCases } from '../../application/use-cases/admin/AdminAppResourceUseCases';

// Infrastructure — controllers (admin)
import { AdminUserController } from '../web/controllers/AdminUserController';
import { AdminTenantController } from '../web/controllers/AdminTenantController';
import { RoleController } from '../web/controllers/RoleController';
import { ApplicationsController } from '../web/controllers/ApplicationsController';
import { StatsController } from '../web/controllers/StatsController';
import { AppResourceController } from '../web/controllers/AppResourceController';
import { UtilController } from '../web/controllers/UtilController';
import { ApplicationSyncController } from '../web/controllers/ApplicationSyncController';
import { MetadataController } from '../web/controllers/MetadataController';

// Infrastructure — auth middleware
import { VerifySessionUseCase } from '../../application/use-cases/auth/VerifySessionUseCase';
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
      process.env.EMAIL_FROM ?? 'noreply@bigso.co'
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
    const keyFactory     = new RedisKeyFactory();
    const tenantVersions = new TenantVersionService(this.redis); // O(1) group invalidation
    const anyCache       = () => new RedisCacheService<any>(this.redis);
    const strCache       = () => new RedisCacheService<string>(this.redis);
    const strArrCache    = () => new RedisCacheService<string[]>(this.redis);

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

    // ── Use cases ────────────────────────────────────────────────────────────
    const loginUseCase = new LoginUseCase(
      userRepository,
      sessionRepository,
      refreshTokenRepository,
      tokenService,
      auditService,
      eventBus,
      hashService,
      passwordHasher
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
      this.prisma
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

    // ── Register in map ──────────────────────────────────────────────────────
    this.instances.set('PrismaClient', this.prisma);
    this.instances.set('RedisClient', this.redis);

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

    this.instances.set('LoginUseCase', loginUseCase);
    this.instances.set('LogoutUseCase', logoutUseCase);
    this.instances.set('RefreshTokenUseCase', refreshTokenUseCase);
    this.instances.set('RegisterUserUseCase', registerUserUseCase);
    this.instances.set('CreateAppSessionUseCase', createAppSessionUseCase);
    this.instances.set('CreateTenantUseCase', createTenantUseCase);

    // ── Admin use cases (all use injected PrismaClient, zero src/ imports) ───
    const adminUsers        = new AdminUserUseCases(this.prisma);
    const adminTenants      = new AdminTenantUseCases(this.prisma);
    const adminApplications = new AdminApplicationUseCases(this.prisma);
    const adminRoles        = new AdminRoleUseCases(this.prisma);
    const adminStats        = new AdminStatsUseCases(this.prisma);
    const adminAppResources = new AdminAppResourceUseCases(this.prisma);

    this.instances.set('AdminUserUseCases',        adminUsers);
    this.instances.set('AdminTenantUseCases',      adminTenants);
    this.instances.set('AdminApplicationUseCases', adminApplications);
    this.instances.set('AdminRoleUseCases',        adminRoles);
    this.instances.set('AdminStatsUseCases',       adminStats);
    this.instances.set('AdminAppResourceUseCases', adminAppResources);

    // ── Admin controllers ─────────────────────────────────────────────────────
    this.instances.set('AdminUserController',        new AdminUserController(adminUsers));
    this.instances.set('TenantController',      new AdminTenantController(adminTenants));
    this.instances.set('RoleController',              new RoleController(adminRoles));
    this.instances.set('ApplicationsController',      new ApplicationsController(adminApplications));
    this.instances.set('ApplicationSyncController',   new ApplicationSyncController(this.prisma, adminAppResources));
    this.instances.set('StatsController',             new StatsController(adminStats));
    this.instances.set('AppResourceController',       new AppResourceController(adminAppResources));
    this.instances.set('UtilController',              new UtilController());
    this.instances.set('MetadataController',          new MetadataController());

    // ── Auth middleware factory ───────────────────────────────────────────────
    const verifySessionUseCase = new VerifySessionUseCase(
      sessionRepository,
      tokenService,
      auditService
    );
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
