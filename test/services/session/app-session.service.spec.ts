/**
 * Tests para AppSessionService
 * Cubre: createSession, revokeSession, revokeAllUserSessions
 */

import { AppSessionService, SessionValidationError } from '../../../src/services/session/app-session.service';
import { SessionRepository } from '../../../src/core/repositories/session.repository';
import { RedisSessionService } from '../../../src/services/session/redis-session.service';
import { Config } from '../../../src/config';
import { JWT } from '../../../src/services/jwt';
import { resetRedisMock } from '../../../src/__tests__/__mocks__/redis.mock';

// Mocks manuales (usados automáticamente por Jest)
jest.mock('../../../src/config');
jest.mock('../../../src/services/jwt');

// Mock de Prisma
const mockPrismaClient: any = {
  tenantMember: {
    findMany: jest.fn(),
  },
  application: {
    findUnique: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
  },
  permission: {
    findMany: jest.fn(),
  },
};

jest.mock('../../../src/services/prisma', () => ({
  getPrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock de Logger
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AppSessionService', () => {
  let service: AppSessionService;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockRedisService: jest.Mocked<RedisSessionService>;

  const mockUser = {
    id: 'user-123',
    email: 'user@test.com',
    userStatus: 'active',
    systemRole: 'user',
  };

  beforeEach(async () => {
    resetRedisMock();
    jest.clearAllMocks();

    // Configurar mocks base
    (Config.get as jest.Mock).mockImplementation((key: string, defaultValue: any) => defaultValue);
    (JWT.generateToken as jest.Mock).mockReturnValue('mock-access-token');

    // Configurar mocks de Redis
    mockRedisService = {
      SESSION_PREFIX: 'session:',
      REVOKED_PREFIX: 'revoked:',
      REFRESH_PREFIX: 'refresh:',
      FAMILY_PREFIX: 'refresh_family:',
      PERMISSIONS_PREFIX: 'permissions:',
      isAvailable: jest.fn(() => true),
      saveSession: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn(),
      revokeSession: jest.fn(),
      isSessionRevoked: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      saveRefreshToken: jest.fn(),
      getRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      markRefreshTokenFamilyUsed: jest.fn(),
      isRefreshTokenFamilyUsed: jest.fn(),
      cachePermissions: jest.fn(),
      getPermissions: jest.fn(),
      deletePermissions: jest.fn(),
    } as any;

    // Configurar mocks del repositorio
    mockSessionRepo = {
      prisma: {} as any,
      createSSOSession: jest.fn(),
      findSSOSessionByToken: jest.fn(),
      deleteSSOSession: jest.fn(),
      deleteAllSSOSessionsForUser: jest.fn(),
      updateSSOSessionActivity: jest.fn(),
      extendSSOSession: jest.fn(),
      getActiveSSOSessionsForUser: jest.fn(),
      cleanupExpiredSSOSessions: jest.fn(),
      createAppSession: jest.fn().mockResolvedValue({} as any),
      findAppSessionByToken: jest.fn(),
      deleteAppSession: jest.fn(),
      deleteAllAppSessionsForUser: jest.fn(),
      updateAppSessionActivity: jest.fn(),
      extendAppSession: jest.fn(),
      getActiveAppSessionsForUser: jest.fn(),
      cleanupExpiredAppSessions: jest.fn(),
    } as any;

    // Resetear mocks de Prisma
    Object.keys(mockPrismaClient).forEach((key) => {
      const model = mockPrismaClient[key];
      if (model && typeof model === 'object') {
        Object.keys(model).forEach((method) => {
          if (typeof model[method] === 'function') {
            model[method].mockClear();
          }
        });
      }
    });

    // Configurar mocks de Prisma por defecto
    mockPrismaClient.tenantMember.findMany.mockResolvedValue([]);
    mockPrismaClient.application.findUnique.mockResolvedValue(null);
    mockPrismaClient.role.findFirst.mockResolvedValue(null);
    mockPrismaClient.permission.findMany.mockResolvedValue([]);

    // Usar isolateModules para cargar el servicio con mocks frescos
    await jest.isolateModules(async () => {
      const mod = await import('../../../src/services/session/app-session.service');
      const AppSessionServiceClass = mod.AppSessionService;
      service = new AppSessionServiceClass(mockSessionRepo, mockRedisService);
    });
  });

  describe('createSession', () => {
    it('debe crear sesión App exitosamente', async () => {
      // Arrange
      const deviceInfo = { ip: '127.0.0.1', userAgent: 'Mozilla/5.0' };
      const appContext = { appId: 'app-123' };

      // Act
      const result = await service.createSession(mockUser.id, mockUser, deviceInfo, appContext);

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).toHaveLength(128); // 64 bytes hex
      expect(result.jti).toBeDefined();
      expect(result.tenants).toEqual([]);
      expect(result.permissions).toEqual([]);
    });

    it('debe lanzar USER_NOT_FOUND si usuario no existe', async () => {
      // Arrange & Act & Assert
      await expect(service.createSession(mockUser.id, null as any, undefined, {}))
        .rejects.toThrow(SessionValidationError);
      await expect(service.createSession(mockUser.id, null as any, undefined, {}))
        .rejects.toHaveProperty('code', 'USER_NOT_FOUND');
    });

    it('debe lanzar ACCOUNT_NOT_ACTIVE si usuario no está activo', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, userStatus: 'inactive' };

      // Act & Assert
      await expect(service.createSession(mockUser.id, inactiveUser, undefined, {}))
        .rejects.toThrow(SessionValidationError);
      await expect(service.createSession(mockUser.id, inactiveUser, undefined, {}))
        .rejects.toHaveProperty('code', 'ACCOUNT_NOT_ACTIVE');
    });

    it('debe obtener tenant memberships del usuario', async () => {
      // Arrange
      const mockTenantMembers = [
        {
          tenantId: 'tenant-123',
          role: 'admin',
          tenant: { id: 'tenant-123', name: 'Test Tenant', slug: 'test' },
        },
      ];
      mockPrismaClient.tenantMember.findMany.mockResolvedValue(mockTenantMembers);

      // Act
      await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(mockPrismaClient.tenantMember.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: mockUser.id,
        }),
        include: { tenant: true },
      });
    });

    it('debe retornar tenants del usuario', async () => {
      // Arrange
      const mockTenantMembers = [
        {
          tenantId: 'tenant-123',
          role: 'admin',
          tenant: { id: 'tenant-123', name: 'Test Tenant', slug: 'test' },
        },
      ];
      mockPrismaClient.tenantMember.findMany.mockResolvedValue(mockTenantMembers);

      // Act
      const result = await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(result.tenants).toEqual([
        { id: 'tenant-123', name: 'Test Tenant', slug: 'test', role: 'admin' },
      ]);
    });

    it('debe obtener permissions del rol', async () => {
      // Arrange
      const mockRole = { id: 'role-123', name: 'admin' };
      const mockPermissions = [
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'write' },
      ];
      mockPrismaClient.tenantMember.findMany.mockResolvedValue([
        { tenantId: 'tenant-123', role: 'admin', tenant: { id: 'tenant-123' } },
      ]);
      mockPrismaClient.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaClient.permission.findMany.mockResolvedValue(mockPermissions);

      // Act
      const result = await service.createSession(mockUser.id, mockUser, undefined, {
        appId: 'app-123',
        tenantId: 'tenant-123',
      });

      // Assert
      expect(result.permissions).toEqual(mockPermissions);
    });

    it('debe guardar sesión en PostgreSQL', async () => {
      // Arrange
      (Config.get as jest.Mock).mockReturnValue(900);

      // Act
      await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(mockSessionRepo.createAppSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: expect.stringContaining('app_v2_'),
          appId: 'app-123',
          userId: mockUser.id,
        })
      );
    });

    it('debe guardar sesión en Redis si está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(mockRedisService.saveSession).toHaveBeenCalled();
    });

    it('debe continuar sin Redis si no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      const result = await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(mockRedisService.saveSession).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.saveSession.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(result.accessToken).toBe('mock-access-token');
      expect(mockSessionRepo.createAppSession).toHaveBeenCalled();
    });

    it('debe usar TTL de config para access token', async () => {
      // Arrange
      (Config.get as jest.Mock).mockReturnValue(1800); // 30 minutos

      // Act
      await service.createSession(mockUser.id, mockUser, undefined, { appId: 'app-123' });

      // Assert
      expect(Config.get).toHaveBeenCalledWith('v2.access_token_expiry', 900);
    });
  });

  describe('revokeSession', () => {
    it('debe revocar sesión en Redis y PostgreSQL', async () => {
      // Arrange
      const jti = 'jti-123';
      const userId = 'user-123';

      // Act
      await service.revokeSession(jti, userId);

      // Assert
      expect(mockRedisService.revokeSession).toHaveBeenCalledWith(jti, userId);
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith(`app_v2_${jti}`);
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.revokeSession.mockRejectedValue(new Error('Redis error'));

      // Act
      await service.revokeSession('jti-123');

      // Assert
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith('app_v2_jti-123');
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeSession('jti-123');

      // Assert
      expect(mockRedisService.revokeSession).not.toHaveBeenCalled();
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith('app_v2_jti-123');
    });
  });

  describe('revokeAllUserSessions', () => {
    it('debe revocar todas las sesiones en Redis y PostgreSQL', async () => {
      // Arrange
      const userId = 'user-123';
      mockSessionRepo.deleteAllAppSessionsForUser.mockResolvedValue(3);

      // Act
      const result = await service.revokeAllUserSessions(userId);

      // Assert
      expect(mockRedisService.revokeAllUserSessions).toHaveBeenCalledWith(userId);
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalledWith(userId);
      expect(result).toBe(3);
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.revokeAllUserSessions.mockRejectedValue(new Error('Redis error'));
      mockSessionRepo.deleteAllAppSessionsForUser.mockResolvedValue(2);

      // Act
      const result = await service.revokeAllUserSessions('user-123');

      // Assert
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.deleteAllAppSessionsForUser.mockResolvedValue(1);

      // Act
      const result = await service.revokeAllUserSessions('user-123');

      // Assert
      expect(mockRedisService.revokeAllUserSessions).not.toHaveBeenCalled();
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });
});
