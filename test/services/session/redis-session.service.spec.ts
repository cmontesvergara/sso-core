/**
 * Tests para RedisSessionService
 * Cubre: operaciones de sesión, refresh tokens, y permisos en Redis
 */

import { RedisSessionService } from '../../../src/services/session/redis-session.service';

// Mock del cliente Redis
const mockRedisClient: any = {
  // Comandos básicos
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),

  // Sets
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(false),
  srem: jest.fn().mockResolvedValue(1),

  // Control de conexión
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),

  // Event listeners
  on: jest.fn(),

  // Estado
  status: 'ready',

  // Transacciones
  multi: jest.fn(() => ({
    exec: jest.fn().mockResolvedValue([]),
  })),

  // Scan para iteración
  scan: jest.fn().mockResolvedValue([null, []]),

  // TTL
  expire: jest.fn().mockResolvedValue(1),
};

// Mock del módulo redis
jest.mock('../../../src/services/redis', () => ({
  getRedisClient: jest.fn(() => mockRedisClient),
  isRedisAvailable: jest.fn(() => true),
  initRedis: jest.fn().mockResolvedValue(undefined),
  closeRedis: jest.fn().mockResolvedValue(undefined),
}));

describe('RedisSessionService', () => {
  let service: RedisSessionService;
  let mockRedis: any;
  let mockIsRedisAvailable: jest.Mock;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Resetear mock del cliente Redis
    Object.keys(mockRedisClient).forEach((key) => {
      if (typeof mockRedisClient[key] === 'function') {
        mockRedisClient[key].mockClear();
        // Restaurar valores por defecto
        if (key === 'get') mockRedisClient[key].mockResolvedValue(null);
        if (key === 'set' || key === 'setex') mockRedisClient[key].mockResolvedValue('OK');
        if (key === 'del') mockRedisClient[key].mockResolvedValue(1);
        if (key === 'keys') mockRedisClient[key].mockResolvedValue([]);
        if (key === 'sadd') mockRedisClient[key].mockResolvedValue(1);
        if (key === 'smembers') mockRedisClient[key].mockResolvedValue([]);
        if (key === 'ping') mockRedisClient[key].mockResolvedValue('PONG');
        if (key === 'quit') mockRedisClient[key].mockResolvedValue('OK');
        if (key === 'scan') mockRedisClient[key].mockResolvedValue([null, []]);
        if (key === 'multi') mockRedisClient[key].mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });
        if (key === 'expire') mockRedisClient[key].mockResolvedValue(1);
      }
    });
    mockRedisClient.status = 'ready';

    // Obtener referencias a los mocks
    const redisModule = await import('../../../src/services/redis');
    mockRedis = mockRedisClient;
    mockIsRedisAvailable = redisModule.isRedisAvailable as jest.Mock;
    mockIsRedisAvailable.mockReturnValue(true);

    // Usar isolateModules para cargar el servicio con mocks frescos
    await jest.isolateModules(async () => {
      const mod = await import('../../../src/services/session/redis-session.service');
      const RedisSessionServiceClass = mod.RedisSessionService;
      service = new RedisSessionServiceClass();
    });
  });

  describe('isAvailable', () => {
    it('debe retornar true si Redis está disponible', () => {
      // Act
      const result = service.isAvailable();

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false si Redis no está disponible', () => {
      // Arrange
      mockIsRedisAvailable.mockReturnValue(false);

      // Act
      const result = service.isAvailable();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('saveSession', () => {
    it('debe guardar sesión SSO en Redis', async () => {
      // Arrange
      const jti = 'jti-123';
      const userId = 'user-123';
      const data = { ip: '127.0.0.1', userAgent: 'Mozilla/5.0' };
      const ttlSeconds = 3600;

      // Act
      await service.saveSession(jti, userId, data, ttlSeconds, 'sso');

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:sso:jti-123',
        ttlSeconds,
        JSON.stringify({ jti, userId, ...data, sessionType: 'sso' })
      );
    });

    it('debe guardar sesión App en Redis', async () => {
      // Arrange
      const jti = 'jti-456';
      const userId = 'user-456';
      const data = { ip: '192.168.1.1' };
      const ttlSeconds = 7200;

      // Act
      await service.saveSession(jti, userId, data, ttlSeconds, 'app');

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:app:jti-456',
        ttlSeconds,
        JSON.stringify({ jti, userId, ...data, sessionType: 'app' })
      );
    });
  });

  describe('getSession', () => {
    it('debe obtener sesión de Redis', async () => {
      // Arrange
      const jti = 'jti-123';
      const sessionData = { jti, userId: 'user-123', sessionType: 'sso' };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      // Act
      const result = await service.getSession(jti, 'sso');

      // Assert
      expect(mockRedis.get).toHaveBeenCalledWith('session:sso:jti-123');
      expect(result).toEqual(sessionData);
    });

    it('debe retornar null si sesión no existe', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.getSession('jti-123', 'app');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('debe revocar sesión y marcar como revocada', async () => {
      // Arrange
      const jti = 'jti-123';
      const userId = 'user-123';

      // Act
      await service.revokeSession(jti, userId);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith('revoked:jti-123', 3600, '1');
      expect(mockRedis.del).toHaveBeenCalledWith('session:sso:jti-123');
      expect(mockRedis.del).toHaveBeenCalledWith('session:app:jti-123');
      expect(mockRedis.sadd).toHaveBeenCalledWith('user_sessions:user-123', jti);
      expect(mockRedis.expire).toHaveBeenCalledWith('user_sessions:user-123', 3600);
    });

    it('debe revocar sesión sin userId', async () => {
      // Arrange
      const jti = 'jti-456';

      // Act
      await service.revokeSession(jti);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith('revoked:jti-456', 3600, '1');
      expect(mockRedis.del).toHaveBeenCalledWith('session:sso:jti-456');
      expect(mockRedis.del).toHaveBeenCalledWith('session:app:jti-456');
      expect(mockRedis.sadd).not.toHaveBeenCalled();
    });
  });

  describe('isSessionRevoked', () => {
    it('debe retornar true si sesión está revocada', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue('1');

      // Act
      const result = await service.isSessionRevoked('jti-123');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false si sesión no está revocada', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.isSessionRevoked('jti-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('debe revocar todas las sesiones de un usuario', async () => {
      // Arrange
      const userId = 'user-123';
      const sessionKeys = ['session:sso:jti-1', 'session:app:jti-2'];
      const userSessions = ['jti-1', 'jti-2'];

      mockRedis.keys.mockResolvedValue(sessionKeys);
      mockRedis.smembers.mockResolvedValue(userSessions);

      // Act
      await service.revokeAllUserSessions(userId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(...sessionKeys);
      expect(mockRedis.setex).toHaveBeenCalledWith('revoked:jti-1', 3600, '1');
      expect(mockRedis.setex).toHaveBeenCalledWith('revoked:jti-2', 3600, '1');
      expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:user-123');
    });

    it('debe manejar usuario sin sesiones', async () => {
      // Arrange
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.smembers.mockResolvedValue([]);

      // Act
      await service.revokeAllUserSessions('user-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:user-123');
    });
  });

  describe('refresh token operations', () => {
    it('debe guardar refresh token en Redis', async () => {
      // Arrange
      const tokenHash = 'hash-123';
      const data = {
        userId: 'user-123',
        jti: 'jti-123',
        familyId: 'family-123',
        createdAt: Math.floor(Date.now() / 1000),
      };
      const ttlSeconds = 7 * 24 * 60 * 60;

      // Act
      await service.saveRefreshToken(tokenHash, data, ttlSeconds);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `refresh:${tokenHash}`,
        ttlSeconds,
        JSON.stringify(data)
      );
    });

    it('debe obtener refresh token de Redis', async () => {
      // Arrange
      const tokenHash = 'hash-123';
      const data = {
        userId: 'user-123',
        jti: 'jti-123',
        familyId: 'family-123',
        createdAt: Math.floor(Date.now() / 1000),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      // Act
      const result = await service.getRefreshToken(tokenHash);

      // Assert
      expect(result).toEqual(data);
    });

    it('debe retornar null si refresh token no existe', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.getRefreshToken('hash-123');

      // Assert
      expect(result).toBeNull();
    });

    it('debe eliminar refresh token', async () => {
      // Arrange
      const tokenHash = 'hash-123';

      // Act
      await service.deleteRefreshToken(tokenHash);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${tokenHash}`);
    });

    it('debe marcar familia de refresh token como usada', async () => {
      // Arrange
      const familyId = 'family-123';

      // Act
      await service.markRefreshTokenFamilyUsed(familyId);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(`refresh_family:${familyId}`, 3600, '1');
    });

    it('debe verificar si familia de refresh token fue usada', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue('1');

      // Act
      const result = await service.isRefreshTokenFamilyUsed('family-123');

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false si familia no fue usada', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.isRefreshTokenFamilyUsed('family-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('permissions operations', () => {
    it('debe cachear permisos', async () => {
      // Arrange
      const jti = 'jti-123';
      const permissions = [
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'write' },
      ];
      const ttlSeconds = 300;

      // Act
      await service.cachePermissions(jti, permissions, ttlSeconds);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `permissions:${jti}`,
        ttlSeconds,
        JSON.stringify(permissions)
      );
    });

    it('debe obtener permisos del caché', async () => {
      // Arrange
      const jti = 'jti-123';
      const permissions = [{ resource: 'users', action: 'read' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(permissions));

      // Act
      const result = await service.getPermissions(jti);

      // Assert
      expect(result).toEqual(permissions);
    });

    it('debe retornar null si permisos no están en caché', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.getPermissions('jti-123');

      // Assert
      expect(result).toBeNull();
    });

    it('debe eliminar permisos del caché', async () => {
      // Arrange
      const jti = 'jti-123';

      // Act
      await service.deletePermissions(jti);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`permissions:${jti}`);
    });
  });
});
