/**
 * Tests para RefreshTokenService
 * Cubre: saveToken, rotateToken, validateToken, revokeAllUserTokens
 */

import { RefreshTokenService, RefreshTokenValidationError } from '../../../src/services/session/refresh-token.service';
import { RefreshTokenRepository } from '../../../src/core/repositories/refresh-token.repository';
import { RedisSessionService } from '../../../src/services/session/redis-session.service';
import { AppSessionService } from '../../../src/services/session/app-session.service';
import { resetRedisMock } from '../../../src/__tests__/__mocks__/redis.mock';
import { createMockUser } from '../../../src/__tests__/test-utils';

// Mock de Config
jest.mock('../../../src/config', () => ({
  Config: {
    get: jest.fn((key: string, defaultValue: any) => defaultValue),
  },
}));

// Mock de Logger
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock de AppSessionService
jest.mock('../../../src/services/session/app-session.service', () => ({
  AppSessionService: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
  })),
}));

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockRefreshRepo: jest.Mocked<RefreshTokenRepository>;
  let mockRedisService: jest.Mocked<RedisSessionService>;
  let mockAppSessionService: jest.Mocked<AppSessionService>;

  const mockUser = createMockUser();
  const testPepper = 'test-pepper-for-unit-tests-32-chars!';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    resetRedisMock();

    // Configurar variable de entorno
    process.env.REFRESH_TOKEN_PEPPER = testPepper;

    // Crear repositorios mock
    mockRefreshRepo = {
      prisma: {} as any,
      saveRefreshToken: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      revokeRefreshTokenById: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn(),
      findRefreshTokensByUser: jest.fn(),
      findActiveRefreshTokensByUser: jest.fn(),
      cleanupExpiredRefreshTokens: jest.fn(),
      countActiveRefreshTokensForUser: jest.fn(),
    } as any;

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

    mockAppSessionService = {
      createSession: jest.fn(),
    } as any;

    service = new RefreshTokenService(mockRefreshRepo, mockRedisService, mockAppSessionService);
  });

  afterEach(() => {
    delete process.env.REFRESH_TOKEN_PEPPER;
  });

  describe('constructor', () => {
    it('debe lanzar error si REFRESH_TOKEN_PEPPER no está definido', () => {
      // Arrange
      delete process.env.REFRESH_TOKEN_PEPPER;

      // Act & Assert
      expect(() => new RefreshTokenService(mockRefreshRepo, mockRedisService, mockAppSessionService))
        .toThrow('REFRESH_TOKEN_PEPPER environment variable is required');
    });
  });

  describe('saveToken', () => {
    it('debe generar y guardar refresh token exitosamente', async () => {
      // Arrange
      mockRefreshRepo.saveRefreshToken.mockResolvedValue({} as any);
      mockRedisService.saveRefreshToken.mockResolvedValue('OK' as any);

      // Act
      const result = await service.saveToken(mockUser.id, 'jti-123', {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      // Assert
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).toHaveLength(128); // 64 bytes hex = 128 chars
      expect(result.familyId).toBeDefined();
      expect(mockRefreshRepo.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          clientId: 'app_v2_jti-123',
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });

    it('debe guardar token en Redis si está disponible', async () => {
      // Arrange
      mockRefreshRepo.saveRefreshToken.mockResolvedValue({} as any);
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.saveToken(mockUser.id, 'jti-123');

      // Assert
      expect(mockRedisService.saveRefreshToken).toHaveBeenCalled();
    });

    it('debe continuar si Redis falla (fallback silencioso)', async () => {
      // Arrange
      mockRefreshRepo.saveRefreshToken.mockResolvedValue({} as any);
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.saveRefreshToken.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.saveToken(mockUser.id, 'jti-123');

      // Assert
      expect(result.refreshToken).toBeDefined();
      expect(result.familyId).toBeDefined();
    });

    it('debe usar expiry por defecto de 7 días', async () => {
      // Arrange
      mockRefreshRepo.saveRefreshToken.mockResolvedValue({} as any);

      // Act
      await service.saveToken(mockUser.id, 'jti-123');

      // Assert
      expect(mockRefreshRepo.saveRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });
  });

  describe('rotateToken', () => {
    it('debe rotar token válido desde Redis', async () => {
      // Arrange
      const mockTokenData = {
        userId: mockUser.id,
        jti: 'jti-123',
        familyId: 'family-123',
        createdAt: Math.floor(Date.now() / 1000),
      };
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.getRefreshToken.mockResolvedValue(mockTokenData as any);
      mockRedisService.isRefreshTokenFamilyUsed.mockResolvedValue(false);
      mockRedisService.deleteRefreshToken.mockResolvedValue(undefined);
      mockRedisService.markRefreshTokenFamilyUsed.mockResolvedValue(undefined);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({ id: '1', revoked: false } as any);
      mockRefreshRepo.revokeRefreshTokenById.mockResolvedValue(undefined);
      mockAppSessionService.createSession.mockResolvedValue({
        user: mockUser,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        jti: 'new-jti',
        tenants: [],
        permissions: [],
      });

      // Act
      const result = await service.rotateToken('valid-refresh-token');

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalled();
      expect(mockRefreshRepo.revokeRefreshTokenById).toHaveBeenCalled();
    });

    it('debe lanzar TOKEN_REUSE_DETECTED si token ya fue usado', async () => {
      // Arrange
      const mockTokenData = {
        userId: mockUser.id,
        jti: 'jti-123',
        familyId: 'family-123',
        createdAt: Math.floor(Date.now() / 1000),
      };
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.getRefreshToken.mockResolvedValue(mockTokenData as any);
      mockRedisService.isRefreshTokenFamilyUsed.mockResolvedValue(true);
      mockRedisService.revokeAllUserSessions.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.rotateToken('reused-token')).rejects.toThrow(
        RefreshTokenValidationError
      );
      await expect(service.rotateToken('reused-token')).rejects.toHaveProperty(
        'code',
        'TOKEN_REUSE_DETECTED'
      );
      expect(mockRedisService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe caer a PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 días en el futuro
      } as any);
      mockRefreshRepo.revokeRefreshTokenById.mockResolvedValue(undefined);
      mockAppSessionService.createSession.mockResolvedValue({
        user: mockUser,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        jti: 'new-jti',
        tenants: [],
        permissions: [],
      });

      // Act
      const result = await service.rotateToken('valid-refresh-token');

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(mockRefreshRepo.findRefreshTokenByHash).toHaveBeenCalled();
      expect(mockRefreshRepo.revokeRefreshTokenById).toHaveBeenCalled();
    });

    it('debe lanzar INVALID_REFRESH_TOKEN si token no existe en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue(null);

      // Act & Assert
      await expect(service.rotateToken('invalid-token')).rejects.toThrow(
        RefreshTokenValidationError
      );
      await expect(service.rotateToken('invalid-token')).rejects.toHaveProperty(
        'code',
        'INVALID_REFRESH_TOKEN'
      );
    });

    it('debe lanzar TOKEN_REUSE_DETECTED si token está revocado en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: true,
      } as any);
      mockRefreshRepo.revokeAllRefreshTokensForUser.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.rotateToken('revoked-token')).rejects.toThrow(
        RefreshTokenValidationError
      );
      await expect(service.rotateToken('revoked-token')).rejects.toHaveProperty(
        'code',
        'TOKEN_REUSE_DETECTED'
      );
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe lanzar REFRESH_TOKEN_EXPIRED si token expiró', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: false,
        expiresAt: new Date('2020-01-01'), // Expirado
      } as any);

      // Act & Assert
      await expect(service.rotateToken('expired-token')).rejects.toThrow(
        RefreshTokenValidationError
      );
      await expect(service.rotateToken('expired-token')).rejects.toHaveProperty(
        'code',
        'REFRESH_TOKEN_EXPIRED'
      );
    });
  });

  describe('validateToken', () => {
    it('debe retornar isValid: true para token válido en Redis', async () => {
      // Arrange
      const mockTokenData = {
        userId: mockUser.id,
        jti: 'jti-123',
        familyId: 'family-123',
        createdAt: Math.floor(Date.now() / 1000),
      };
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.getRefreshToken.mockResolvedValue(mockTokenData as any);

      // Act
      const result = await service.validateToken('valid-refresh-token');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(mockUser.id);
    });

    it('debe retornar isValid: false para token inválido', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue(null);

      // Act
      const result = await service.validateToken('invalid-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_REFRESH_TOKEN');
    });

    it('debe retornar isValid: false para token revocado', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: true,
        expiresAt: new Date('2099-01-01'),
      } as any);

      // Act
      const result = await service.validateToken('revoked-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOKEN_REVOKED');
    });

    it('debe retornar isValid: false para token expirado', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: false,
        expiresAt: new Date('2020-01-01'),
      } as any);

      // Act
      const result = await service.validateToken('expired-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('REFRESH_TOKEN_EXPIRED');
    });

    it('debe caer a PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.getRefreshToken.mockRejectedValue(new Error('Redis error'));
      mockRefreshRepo.findRefreshTokenByHash.mockResolvedValue({
        id: '1',
        userId: mockUser.id,
        revoked: false,
        expiresAt: new Date('2099-01-01'),
      } as any);

      // Act
      const result = await service.validateToken('valid-token');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(mockUser.id);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('debe revocar todas las sesiones en Redis y PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);

      // Act
      await service.revokeAllUserTokens(mockUser.id);

      // Assert
      expect(mockRedisService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id);
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.revokeAllUserSessions.mockRejectedValue(new Error('Redis error'));

      // Act
      await service.revokeAllUserTokens(mockUser.id);

      // Assert
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeAllUserTokens(mockUser.id);

      // Assert
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
