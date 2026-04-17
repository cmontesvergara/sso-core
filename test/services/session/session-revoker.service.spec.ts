/**
 * Tests para SessionRevokerService
 * Cubre: revokeSsoSession, revokeAppSession, revokeAllUserSessions, cleanupExpiredSessions
 */

import { SessionRevokerService } from '../../../src/services/session/session-revoker.service';
import { SessionRepository } from '../../../src/core/repositories/session.repository';
import { RefreshTokenRepository } from '../../../src/core/repositories/refresh-token.repository';
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

describe('SessionRevokerService', () => {
  let service: SessionRevokerService;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockRefreshRepo: jest.Mocked<RefreshTokenRepository>;
  let mockRedisService: jest.Mocked<RedisSessionService>;

  beforeEach(async () => {
    // Reset mocks
    resetRedisMock();
    jest.clearAllMocks();

    // Configurar mocks base
    (Config.get as jest.Mock).mockImplementation((key: string, defaultValue: any) => defaultValue);
    (JWT.verifyToken as jest.Mock).mockReturnValue({ sub: 'user-123', jti: 'jti-123' });
    (JWT.decodeToken as jest.Mock).mockReturnValue({ sub: 'user-123', jti: 'jti-123' });

    // Configurar mocks base de Redis
    mockRedisService = {
      SESSION_PREFIX: 'session:',
      REVOKED_PREFIX: 'revoked:',
      REFRESH_PREFIX: 'refresh:',
      FAMILY_PREFIX: 'refresh_family:',
      PERMISSIONS_PREFIX: 'permissions:',
      isAvailable: jest.fn(() => true),
      saveSession: jest.fn(),
      getSession: jest.fn(),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      isSessionRevoked: jest.fn().mockResolvedValue(false),
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
      saveRefreshToken: jest.fn(),
      getRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      markRefreshTokenFamilyUsed: jest.fn(),
      isRefreshTokenFamilyUsed: jest.fn(),
      cachePermissions: jest.fn(),
      getPermissions: jest.fn(),
      deletePermissions: jest.fn(),
    } as any;

    // Configurar mocks base del repositorio
    mockSessionRepo = {
      prisma: {} as any,
      createSSOSession: jest.fn(),
      findSSOSessionByToken: jest.fn(),
      deleteSSOSession: jest.fn().mockResolvedValue(undefined),
      deleteAllSSOSessionsForUser: jest.fn().mockResolvedValue(0),
      updateSSOSessionActivity: jest.fn(),
      extendSSOSession: jest.fn(),
      getActiveSSOSessionsForUser: jest.fn(),
      cleanupExpiredSSOSessions: jest.fn().mockResolvedValue(0),
      createAppSession: jest.fn(),
      findAppSessionByToken: jest.fn(),
      deleteAppSession: jest.fn().mockResolvedValue(undefined),
      deleteAllAppSessionsForUser: jest.fn().mockResolvedValue(0),
      updateAppSessionActivity: jest.fn(),
      extendAppSession: jest.fn(),
      getActiveAppSessionsForUser: jest.fn(),
      cleanupExpiredAppSessions: jest.fn().mockResolvedValue(0),
    } as any;

    mockRefreshRepo = {
      prisma: {} as any,
      saveRefreshToken: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      revokeRefreshTokenById: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn().mockResolvedValue(undefined),
      findRefreshTokensByUser: jest.fn(),
      findActiveRefreshTokensByUser: jest.fn(),
      cleanupExpiredRefreshTokens: jest.fn().mockResolvedValue(0),
      countActiveRefreshTokensForUser: jest.fn(),
    } as any;

    // Usar isolateModules para cargar el servicio con mocks frescos
    await jest.isolateModules(async () => {
      const mod = await import('../../../src/services/session/session-revoker.service');
      const SessionRevokerServiceClass = mod.SessionRevokerService;
      service = new SessionRevokerServiceClass(mockSessionRepo, mockRefreshRepo, mockRedisService);
    });
  });

  describe('revokeSsoSession', () => {
    it('debe revocar sesión SSO en Redis y PostgreSQL', async () => {
      // Arrange
      const jti = 'jti-123';
      const userId = 'user-123';

      // Act
      await service.revokeSsoSession(jti, userId);

      // Assert
      expect(mockRedisService.revokeSession).toHaveBeenCalledWith(jti, userId);
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalledWith('sso_v2_jti-123');
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.revokeSession.mockRejectedValue(new Error('Redis error'));

      // Act
      await service.revokeSsoSession('jti-123');

      // Assert
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalledWith('sso_v2_jti-123');
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeSsoSession('jti-123');

      // Assert
      expect(mockRedisService.revokeSession).not.toHaveBeenCalled();
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalledWith('sso_v2_jti-123');
    });
  });

  describe('revokeAppSession', () => {
    it('debe revocar sesión App en Redis y PostgreSQL', async () => {
      // Arrange
      const jti = 'jti-456';
      const userId = 'user-456';

      // Act
      await service.revokeAppSession(jti, userId);

      // Assert
      expect(mockRedisService.revokeSession).toHaveBeenCalledWith(jti, userId);
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith('app_v2_jti-456');
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.revokeSession.mockRejectedValue(new Error('Redis error'));

      // Act
      await service.revokeAppSession('jti-456');

      // Assert
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith('app_v2_jti-456');
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeAppSession('jti-456');

      // Assert
      expect(mockRedisService.revokeSession).not.toHaveBeenCalled();
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith('app_v2_jti-456');
    });
  });

  describe('revokeAllUserSessions', () => {
    it('debe revocar todas las sesiones en Redis y PostgreSQL', async () => {
      // Arrange
      const userId = 'user-123';
      mockSessionRepo.deleteAllSSOSessionsForUser.mockResolvedValue(2);
      mockSessionRepo.deleteAllAppSessionsForUser.mockResolvedValue(3);

      // Act
      const result = await service.revokeAllUserSessions(userId);

      // Assert
      expect(mockRedisService.revokeAllUserSessions).toHaveBeenCalledWith(userId);
      expect(mockSessionRepo.deleteAllSSOSessionsForUser).toHaveBeenCalledWith(userId);
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalledWith(userId);
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ ssoCount: 2, appCount: 3 });
    });

    it('debe continuar con PostgreSQL si Redis falla', async () => {
      // Arrange
      mockRedisService.revokeAllUserSessions.mockRejectedValue(new Error('Redis error'));

      // Act
      await service.revokeAllUserSessions('user-123');

      // Assert
      expect(mockSessionRepo.deleteAllSSOSessionsForUser).toHaveBeenCalled();
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalled();
      expect(mockRefreshRepo.revokeAllRefreshTokensForUser).toHaveBeenCalled();
    });

    it('debe usar solo PostgreSQL si Redis no está disponible', async () => {
      // Arrange
      mockRedisService.isAvailable.mockReturnValue(false);

      // Act
      await service.revokeAllUserSessions('user-123');

      // Assert
      expect(mockRedisService.revokeAllUserSessions).not.toHaveBeenCalled();
      expect(mockSessionRepo.deleteAllSSOSessionsForUser).toHaveBeenCalled();
      expect(mockSessionRepo.deleteAllAppSessionsForUser).toHaveBeenCalled();
    });
  });

  describe('revokeSessionByToken', () => {
    it('debe revocar sesión SSO por token', async () => {
      // Arrange
      const token = 'sso_v2_jti-123';

      // Act
      await service.revokeSessionByToken(token, 'sso');

      // Assert
      expect(mockSessionRepo.deleteSSOSession).toHaveBeenCalledWith(token);
    });

    it('debe revocar sesión App por token', async () => {
      // Arrange
      const token = 'app_v2_jti-456';

      // Act
      await service.revokeSessionByToken(token, 'app');

      // Assert
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith(token);
    });

    it('debe usar app como default sessionType', async () => {
      // Arrange
      const token = 'app_v2_jti-789';

      // Act
      await service.revokeSessionByToken(token);

      // Assert
      expect(mockSessionRepo.deleteAppSession).toHaveBeenCalledWith(token);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('debe limpiar sesiones expiradas de SSO, App y RefreshTokens', async () => {
      // Arrange
      mockSessionRepo.cleanupExpiredSSOSessions.mockResolvedValue(5);
      mockSessionRepo.cleanupExpiredAppSessions.mockResolvedValue(3);
      mockRefreshRepo.cleanupExpiredRefreshTokens.mockResolvedValue(10);

      // Act
      const result = await service.cleanupExpiredSessions();

      // Assert
      expect(result).toEqual({ ssoCount: 5, appCount: 3, refreshTokenCount: 10 });
    });

    it('debe retornar ceros si no hay sesiones expiradas', async () => {
      // Arrange
      mockSessionRepo.cleanupExpiredSSOSessions.mockResolvedValue(0);
      mockSessionRepo.cleanupExpiredAppSessions.mockResolvedValue(0);
      mockRefreshRepo.cleanupExpiredRefreshTokens.mockResolvedValue(0);

      // Act
      const result = await service.cleanupExpiredSessions();

      // Assert
      expect(result).toEqual({ ssoCount: 0, appCount: 0, refreshTokenCount: 0 });
    });
  });
});
