/**
 * Tests para TokenValidatorService
 * Cubre: validateToken, isTokenRevoked, decodeToken, extractUserInfo
 */

import { SessionRepository } from '../../../src/core/repositories/session.repository';
import { RedisSessionService } from '../../../src/services/session/redis-session.service';
import { resetRedisMock } from '../../../src/__tests__/__mocks__/redis.mock';
import { Config } from '../../../src/config';
import { JWT } from '../../../src/services/jwt';

// Mocks manuales (usados automáticamente por Jest)
jest.mock('../../../src/config');
jest.mock('../../../src/services/jwt');
jest.mock('../../../src/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('TokenValidatorService', () => {
  let service: any;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockRedisService: jest.Mocked<RedisSessionService>;

  const mockDecodedToken = {
    sub: 'user-123',
    jti: 'jti-123',
    iss: 'sso.bigso.co',
    type: 'app',
    exp: Math.floor(Date.now() / 1000) + 3600,
    systemRole: 'user',
    tenantId: 'tenant-123',
    appId: 'app-123',
  };

  beforeEach(async () => {
    // Reset mocks
    resetRedisMock();
    jest.clearAllMocks();

    // Configurar mocks base
    (Config.get as jest.Mock).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'jwt.iss') return 'sso.bigso.co';
      return defaultValue;
    });

    (JWT.verifyToken as jest.Mock).mockReturnValue(mockDecodedToken);
    (JWT.decodeToken as jest.Mock).mockReturnValue(mockDecodedToken);

    // Configurar mocks base de Redis (después de resetRedisMock)
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
      isSessionRevoked: jest.fn().mockResolvedValue(false),
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

    // Configurar mocks base del repositorio (sesiones válidas por defecto)
    const mockAppSession = {
      id: '1',
      sessionToken: 'app_v2_jti-123',
      userId: 'user-123',
      expiresAt: new Date('2099-01-01'),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      ip: null,
      userAgent: null,
    } as any;

    const mockSsoSession = {
      id: '1',
      sessionToken: 'sso_v2_jti-123',
      userId: 'user-123',
      expiresAt: new Date('2099-01-01'),
      lastActivityAt: new Date(),
      createdAt: new Date(),
      ip: null,
      userAgent: null,
    } as any;

    mockSessionRepo = {
      prisma: {} as any,
      createSSOSession: jest.fn(),
      findSSOSessionByToken: jest.fn().mockResolvedValue(mockSsoSession),
      deleteSSOSession: jest.fn(),
      deleteAllSSOSessionsForUser: jest.fn(),
      updateSSOSessionActivity: jest.fn(),
      extendSSOSession: jest.fn(),
      getActiveSSOSessionsForUser: jest.fn(),
      cleanupExpiredSSOSessions: jest.fn(),
      createAppSession: jest.fn(),
      findAppSessionByToken: jest.fn().mockResolvedValue(mockAppSession),
      deleteAppSession: jest.fn(),
      deleteAllAppSessionsForUser: jest.fn(),
      updateAppSessionActivity: jest.fn(),
      extendAppSession: jest.fn(),
      getActiveAppSessionsForUser: jest.fn(),
      cleanupExpiredAppSessions: jest.fn(),
    } as any;

    // Usar isolateModules para cargar el servicio con mocks frescos
    await jest.isolateModules(async () => {
      const mod = await import('../../../src/services/session/token-validator.service');
      const TokenValidatorServiceClass = mod.TokenValidatorService;
      service = new TokenValidatorServiceClass(mockSessionRepo, mockRedisService);
    });
  });

  describe('validateToken', () => {
    it('debe retornar isValid: true para token válido', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue(mockDecodedToken);

      // Act
      const result = await service.validateToken('valid-token');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.jti).toBe('jti-123');
      expect(result.decoded).toEqual(mockDecodedToken);
    });

    it('debe retornar isValid: false para token expirado', async () => {
      // Arrange
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      (JWT.verifyToken as jest.Mock).mockImplementation(() => {
        throw expiredError;
      });

      // Act
      const result = await service.validateToken('expired-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });

    it('debe retornar isValid: false para token con firma inválida', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act
      const result = await service.validateToken('invalid-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN');
    });

    it('debe retornar isValid: false si token no tiene estructura correcta', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue({
        iss: 'sso.bigso.co',
        // Faltan sub y jti
      });

      // Act
      const result = await service.validateToken('malformed-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN_STRUCTURE');
    });

    it('debe retornar isValid: false si issuer no coincide', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue({
        ...mockDecodedToken,
        iss: 'evil.com',
      });

      // Act
      const result = await service.validateToken('wrong-issuer-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN_ISSUER');
    });

    it('debe retornar isValid: false si token está revocado', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue(mockDecodedToken);
      mockRedisService.isSessionRevoked.mockResolvedValue(true);

      // Act
      const result = await service.validateToken('revoked-token');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOKEN_REVOKED');
    });

    it('debe usar default issuer si no está configurado', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue(mockDecodedToken);
      mockRedisService.isSessionRevoked.mockResolvedValue(false);

      // Act
      const result = await service.validateToken('valid-token');

      // Assert
      expect(result.isValid).toBe(true);
      expect(Config.get).toHaveBeenCalledWith('jwt.iss', 'sso.bigso.co');
    });
  });

  describe('isTokenRevoked', () => {
    it('debe retornar false si token no está revocado en Redis', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.isSessionRevoked.mockResolvedValue(false);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'sso');

      // Assert
      expect(result).toBe(false);
      expect(mockRedisService.isSessionRevoked).toHaveBeenCalledWith('jti-123');
    });

    it('debe retornar true si token está revocado en Redis', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.isSessionRevoked.mockResolvedValue(true);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'sso');

      // Assert
      expect(result).toBe(true);
    });

    it('debe caer a PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(true);
      mockRedisService.isSessionRevoked.mockRejectedValue(new Error('Redis error'));
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue({
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: 'user-123',
        expiresAt: new Date('2099-01-01'),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        ip: null,
        userAgent: null,
      } as any);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'sso');

      // Assert
      expect(result).toBe(false);
      expect(mockSessionRepo.findSSOSessionByToken).toHaveBeenCalled();
    });

    it('debe retornar true si sesión no existe en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue(null);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'sso');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar true si sesión expiró en PostgreSQL', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findSSOSessionByToken.mockResolvedValue({
        id: '1',
        sessionToken: 'sso_v2_jti-123',
        userId: 'user-123',
        expiresAt: new Date('2020-01-01'), // Expirada
        lastActivityAt: new Date(),
        createdAt: new Date(),
        ip: null,
        userAgent: null,
      } as any);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'sso');

      // Assert
      expect(result).toBe(true);
    });

    it('debe usar prefijo app_v2_ para sesiones app', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);
      mockSessionRepo.findAppSessionByToken.mockResolvedValue({
        id: '1',
        sessionToken: 'app_v2_jti-123',
        userId: 'user-123',
        expiresAt: new Date('2099-01-01'),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        ip: null,
        userAgent: null,
      } as any);

      // Act
      const result = await service.isTokenRevoked('jti-123', 'app');

      // Assert
      expect(result).toBe(false);
      expect(mockSessionRepo.findAppSessionByToken).toHaveBeenCalledWith('app_v2_jti-123');
    });
  });

  describe('decodeToken', () => {
    it('debe decodificar token sin validar', () => {
      // Arrange
      const mockDecoded = { sub: 'user-123', jti: 'jti-123' };
      (JWT.decodeToken as jest.Mock).mockReturnValue(mockDecoded);

      // Act
      const result = service.decodeToken('any-token');

      // Assert
      expect(result).toEqual(mockDecoded);
      expect((JWT.decodeToken as jest.Mock)).toHaveBeenCalledWith('any-token');
    });
  });

  describe('extractUserInfo', () => {
    it('debe extraer información de usuario de token válido', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockReturnValue(mockDecodedToken);
      mockRedisService.isSessionRevoked.mockResolvedValue(false);

      // Act
      const result = await service.extractUserInfo('valid-token');

      // Assert
      expect(result).toEqual({
        userId: 'user-123',
        jti: 'jti-123',
        type: 'app',
        systemRole: 'user',
        tenantId: 'tenant-123',
        appId: 'app-123',
      });
    });

    it('debe retornar null si token es inválido', async () => {
      // Arrange
      (JWT.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await service.extractUserInfo('invalid-token');

      // Assert
      expect(result).toBeNull();
    });
  });
});
