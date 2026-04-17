/**
 * Tests para SsoSessionService
 * Cubre: createSession, validateToken, isRevoked, revokeSession, revokeAllUserSessions
 */

// JWT mock - must be before jest.mock and imports
const mockJWT = {
  generateToken: jest.fn(() => 'mocked-access-token'),
  verifyToken: jest.fn(),
};

jest.mock('../../../src/services/jwt', () => ({
  JWT: mockJWT,
}));

import { SsoSessionService, SessionValidationError } from '../../../src/services/session/sso-session.service';
import { SessionRepository } from '../../../src/core/repositories/session.repository';
import { RedisSessionService } from '../../../src/services/session/redis-session.service';
import { resetRedisMock } from '../../../src/__tests__/__mocks__/redis.mock';

// Mocks manuales - use automatic manual mock from src/__mocks__/config
jest.mock('../../../src/config');

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
  sSOSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
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

describe('SsoSessionService', () => {
  let service: SsoSessionService;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockRedisService: jest.Mocked<RedisSessionService>;

  const mockUser = {
    id: 'user-123',
    email: 'user@test.com',
    userStatus: 'active',
    systemRole: 'user',
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    resetRedisMock();

    // Configure Config mock to return correct issuer
    const Config = require('../../../src/config').Config;
    Config.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'jwt.iss') return 'https://sso.bigso.co';
      return defaultValue;
    });

    // Configurar mocks de Redis
    mockRedisService = {
      SESSION_PREFIX: 'session:',
      REVOKED_PREFIX: 'revoked:',
      REFRESH_PREFIX: 'refresh:',
      FAMILY_PREFIX: 'refresh_family:',
      PERMISSIONS_PREFIX: 'permissions:',
      isAvailable: jest.fn(() => true),
      saveSession: jest.fn(),
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
      prisma: mockPrismaClient,
      createSSOSession: jest.fn(),
      findSSOSessionByToken: jest.fn(),
      deleteSSOSession: jest.fn(),
      deleteAllSSOSessionsForUser: jest.fn(),
      updateSSOSessionActivity: jest.fn(),
      extendSSOSession: jest.fn(),
      getActiveSSOSessionsForUser: jest.fn(),
      cleanupExpiredSSOSessions: jest.fn(),
      createAppSession: jest.fn(),
      findAppSessionByToken: jest.fn(),
      deleteAppSession: jest.fn(),
      deleteAllAppSessionsForUser: jest.fn(),
      updateAppSessionActivity: jest.fn(),
      extendAppSession: jest.fn(),
      getActiveAppSessionsForUser: jest.fn(),
      cleanupExpiredAppSessions: jest.fn(),
    } as any;

    // Usar isolateModules para cargar el servicio con mocks frescos
    await jest.isolateModules(async () => {
      const mod = await import('../../../src/services/session/sso-session.service');
      const SsoSessionServiceClass = mod.SsoSessionService;
      service = new SsoSessionServiceClass(mockSessionRepo, mockRedisService);
    });
  });

  describe('createSession', () => {
    it('debe crear sesión SSO exitosamente con usuario activo', async () => {
      // Arrange
      const mockSession = {
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      mockSessionRepo.createSSOSession.mockResolvedValue(mockSession);

      // Act
      const result = await service.createSession(
        mockUser.id,
        mockUser,
        { ip: '127.0.0.1', userAgent: 'Mozilla/5.0' },
        { appId: 'test-app', tenantId: 'test-tenant' }
      );

      // Assert
      expect(result).toEqual({
        accessToken: 'mocked-access-token',
        jti: expect.any(String),
      });
      expect(mockSessionRepo.createSSOSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          ip: '127.0.0.1',
        })
      );
    });

    it('debe lanzar USER_NOT_FOUND si el usuario no existe', async () => {
      // Arrange
      const nonExistentUser = undefined;

      // Act & Assert
      await expect(
        service.createSession(mockUser.id, nonExistentUser as any)
      ).rejects.toThrow(SessionValidationError);

      await expect(
        service.createSession(mockUser.id, nonExistentUser as any)
      ).rejects.toHaveProperty('code', 'USER_NOT_FOUND');
    });

    it('debe lanzar ACCOUNT_NOT_ACTIVE si userStatus !== "active"', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, userStatus: 'inactive' };

      // Act & Assert
      await expect(
        service.createSession(mockUser.id, inactiveUser)
      ).rejects.toThrow(SessionValidationError);

      await expect(
        service.createSession(mockUser.id, inactiveUser)
      ).rejects.toHaveProperty('code', 'ACCOUNT_NOT_ACTIVE');
    });

    it('debe generar JWT con payload correcto', async () => {
      // Arrange
      const mockSession = {
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      mockSessionRepo.createSSOSession.mockResolvedValue(mockSession);

      // Act
      await service.createSession(
        mockUser.id,
        mockUser,
        { fingerprint: 'device-123' },
        { appId: 'test-app', tenantId: 'test-tenant' }
      );

      // Assert
      expect(mockJWT.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          type: 'sso',
          systemRole: mockUser.systemRole,
          deviceFingerprint: 'device-123',
          tenantId: 'test-tenant',
          appId: 'test-app',
        }),
        expect.any(Number)
      );
    });

    it('debe escribir sesión en PostgreSQL', async () => {
      // Arrange
      const mockSession = {
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      mockSessionRepo.createSSOSession.mockResolvedValue(mockSession);

      // Act
      await service.createSession(mockUser.id, mockUser);

      // Assert
      expect(mockSessionRepo.createSSOSession).toHaveBeenCalled();
      expect(mockSessionRepo.createSSOSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          sessionToken: expect.stringContaining('sso_v2_'),
        })
      );
    });

    it('debe escribir sesión en Redis si está disponible', async () => {
      // Arrange
      const mockSession = {
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      mockSessionRepo.createSSOSession.mockResolvedValue(mockSession);
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.createSession(mockUser.id, mockUser);

      // Assert
      expect(mockRedisService.saveSession).toHaveBeenCalled();
    });

    it('debe continuar si Redis falla (fallback silencioso)', async () => {
      // Arrange
      const mockSession = {
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      mockSessionRepo.createSSOSession.mockResolvedValue(mockSession);
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.saveSession.mockRejectedValue(new Error('Redis unavailable'));

      // Act
      const result = await service.createSession(mockUser.id, mockUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mocked-access-token');
    });
  });

  describe('validateToken', () => {
    it('debe retornar decoded para token válido', () => {
      // Arrange
      const mockDecoded = {
        sub: mockUser.id,
        jti: 'jti-123',
        type: 'sso',
        iss: 'https://sso.bigso.co',
      };
      mockJWT.verifyToken.mockReturnValue(mockDecoded);

      // Act
      const result = service.validateToken('valid-token');

      // Assert
      expect(result).toEqual(mockDecoded);
    });

    it('debe lanzar INVALID_TOKEN para token mal formado', () => {
      // Arrange
      mockJWT.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => service.validateToken('invalid-token')).toThrow(SessionValidationError);
      expect(() => service.validateToken('invalid-token')).toThrow(
        expect.objectContaining({ code: 'INVALID_TOKEN' })
      );
    });

    it('debe lanzar TOKEN_EXPIRED para token expirado', () => {
      // Arrange
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockJWT.verifyToken.mockImplementation(() => {
        throw expiredError;
      });

      // Act & Assert
      expect(() => service.validateToken('expired-token')).toThrow(SessionValidationError);
      expect(() => service.validateToken('expired-token')).toThrow(
        expect.objectContaining({ code: 'TOKEN_EXPIRED' })
      );
    });

    it('debe lanzar INVALID_TOKEN_ISSUER para issuer incorrecto', () => {
      // Arrange
      mockJWT.verifyToken.mockReturnValue({
        sub: mockUser.id,
        jti: 'jti-123',
        iss: 'https://evil.com',
      });

      // Act & Assert
      expect(() => service.validateToken('wrong-issuer-token')).toThrow(SessionValidationError);
      expect(() => service.validateToken('wrong-issuer-token')).toThrow(
        expect.objectContaining({ code: 'INVALID_TOKEN' })
      );
    });
  });

  describe('isRevoked', () => {
    it('debe retornar true si sesión está en Redis como revocada', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.isSessionRevoked.mockResolvedValue(true);

      // Act
      const result = await service.isRevoked('jti-123');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar true si sesión no existe en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue(null);

      // Act
      const result = await service.isRevoked('jti-123');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar true si sesión expiró en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue({
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        expiresAt: new Date('2020-01-01'), // Expirada
        lastActivityAt: new Date(),
        createdAt: new Date(),
        ip: null,
        userAgent: null,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: 'Test',
          lastName: 'User',
          userStatus: mockUser.userStatus,
          systemRole: mockUser.systemRole,
        },
      });

      // Act
      const result = await service.isRevoked('jti-123');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false si sesión es válida', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue({
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: mockUser.id,
        expiresAt: new Date('2099-01-01'), // No expirada
        lastActivityAt: new Date(),
        createdAt: new Date(),
        ip: null,
        userAgent: null,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: 'Test',
          lastName: 'User',
          userStatus: mockUser.userStatus,
          systemRole: mockUser.systemRole,
        },
      });

      // Act
      const result = await service.isRevoked('jti-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('debe marcar sesión como revocada en Redis', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.revokeSession('jti-123', mockUser.id);

      // Assert
      expect(mockRedisService.revokeSession).toHaveBeenCalledWith('jti-123', mockUser.id);
    });

    it('debe eliminar sesión de PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeSession('jti-123', mockUser.id);

      // Assert
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalledWith('sso_v2_jti-123');
    });

    it('debe continuar si Redis falla', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.revokeSession.mockRejectedValue(new Error('Redis error'));

      // Act
      await expect(service.revokeSession('jti-123', mockUser.id)).resolves.not.toThrow();

      // Assert
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('debe revocar todas las sesiones SSO del usuario en Redis', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.revokeAllUserSessions(mockUser.id);

      // Assert
      expect(mockRedisService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe eliminar todas las sesiones SSO en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.deleteAllSSOSessionsForUser.mockResolvedValue(3);

      // Act
      const result = await service.revokeAllUserSessions(mockUser.id);

      // Assert
      expect(result).toBe(3);
      expect(mockSessionRepo.deleteAllSSOSessionsForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe retornar count de sesiones eliminadas', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.deleteAllSSOSessionsForUser.mockResolvedValue(5);

      // Act
      const result = await service.revokeAllUserSessions(mockUser.id);

      // Assert
      expect(result).toBe(5);
    });
  });
});
