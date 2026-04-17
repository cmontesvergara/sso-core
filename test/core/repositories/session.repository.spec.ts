/**
 * Tests para SessionRepository
 * Cubre: operaciones de SSO y App sessions
 */

import { SessionRepository, CreateSSOSessionDTO, CreateAppSessionDTO } from '../../../src/core/repositories/session.repository';

// Mock del cliente Prisma
const mockPrismaClient: any = {
  sSOSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  appSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

// Mock de Prisma
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

describe('SessionRepository', () => {
  let repository: SessionRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    // Resetear mocks del cliente Prisma
    Object.keys(mockPrismaClient.sSOSession).forEach((key) => {
      (mockPrismaClient.sSOSession[key] as jest.Mock).mockClear();
    });
    Object.keys(mockPrismaClient.appSession).forEach((key) => {
      (mockPrismaClient.appSession[key] as jest.Mock).mockClear();
    });

    repository = new SessionRepository(mockPrismaClient);
  });

  describe('createSSOSession', () => {
    it('debe crear una sesión SSO exitosamente', async () => {
      // Arrange
      const dto: CreateSSOSessionDTO = {
        sessionToken: 'sso_v2_jti-123',
        userId: 'user-123',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
      };

      const mockSession = {
        id: '1',
        ...dto,
        lastActivityAt: new Date(),
        createdAt: new Date(),
      };

      (mockPrismaClient.sSOSession.create as jest.Mock).mockResolvedValue(mockSession);

      // Act
      const result = await repository.createSSOSession(dto);

      // Assert
      expect(mockPrismaClient.sSOSession.create).toHaveBeenCalledWith({
        data: {
          sessionToken: dto.sessionToken,
          userId: dto.userId,
          ip: dto.ip,
          userAgent: dto.userAgent,
          expiresAt: dto.expiresAt,
          lastActivityAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('createAppSession', () => {
    it('debe crear una sesión App exitosamente', async () => {
      // Arrange
      const dto: CreateAppSessionDTO = {
        sessionToken: 'app_v2_jti-456',
        appId: 'app-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'admin',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
      };

      const mockSession = {
        id: '1',
        ...dto,
        lastActivityAt: new Date(),
        createdAt: new Date(),
      };

      (mockPrismaClient.appSession.create as jest.Mock).mockResolvedValue(mockSession);

      // Act
      const result = await repository.createAppSession(dto);

      // Assert
      expect(mockPrismaClient.appSession.create).toHaveBeenCalledWith({
        data: {
          sessionToken: dto.sessionToken,
          appId: dto.appId,
          userId: dto.userId,
          tenantId: dto.tenantId,
          role: dto.role,
          ip: dto.ip,
          userAgent: dto.userAgent,
          expiresAt: dto.expiresAt,
          lastActivityAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('findSSOSessionByToken', () => {
    it('debe encontrar sesión SSO por token con datos del usuario', async () => {
      // Arrange
      const token = 'sso_v2_jti-123';
      const mockSession = {
        id: '1',
        sessionToken: token,
        userId: 'user-123',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
        user: {
          id: 'user-123',
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
          userStatus: 'active',
          systemRole: 'user',
        },
      };

      (mockPrismaClient.sSOSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      // Act
      const result = await repository.findSSOSessionByToken(token);

      // Assert
      expect(mockPrismaClient.sSOSession.findUnique).toHaveBeenCalledWith({
        where: { sessionToken: token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              userStatus: true,
              systemRole: true,
            },
          },
        },
      });
      expect(result).toEqual(mockSession);
    });

    it('debe retornar null si sesión no existe', async () => {
      // Arrange
      (mockPrismaClient.sSOSession.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findSSOSessionByToken('invalid-token');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAppSessionByToken', () => {
    it('debe encontrar sesión App por token', async () => {
      // Arrange
      const token = 'app_v2_jti-456';
      const mockSession = {
        id: '1',
        sessionToken: token,
        appId: 'app-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'admin',
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      (mockPrismaClient.appSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      // Act
      const result = await repository.findAppSessionByToken(token);

      // Assert
      expect(mockPrismaClient.appSession.findUnique).toHaveBeenCalledWith({
        where: { sessionToken: token },
      });
      expect(result).toEqual(mockSession);
    });

    it('debe retornar null si sesión no existe', async () => {
      // Arrange
      (mockPrismaClient.appSession.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findAppSessionByToken('invalid-token');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteSSOSession', () => {
    it('debe eliminar sesión SSO por token', async () => {
      // Arrange
      const token = 'sso_v2_jti-123';

      (mockPrismaClient.sSOSession.delete as jest.Mock).mockResolvedValue({});

      // Act
      await repository.deleteSSOSession(token);

      // Assert
      expect(mockPrismaClient.sSOSession.delete).toHaveBeenCalledWith({
        where: { sessionToken: token },
      });
    });
  });

  describe('deleteAppSession', () => {
    it('debe eliminar sesión App por token', async () => {
      // Arrange
      const token = 'app_v2_jti-456';

      (mockPrismaClient.appSession.delete as jest.Mock).mockResolvedValue({});

      // Act
      await repository.deleteAppSession(token);

      // Assert
      expect(mockPrismaClient.appSession.delete).toHaveBeenCalledWith({
        where: { sessionToken: token },
      });
    });
  });

  describe('deleteAllSSOSessionsForUser', () => {
    it('debe eliminar todas las sesiones SSO de un usuario', async () => {
      // Arrange
      const userId = 'user-123';

      (mockPrismaClient.sSOSession.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

      // Act
      const result = await repository.deleteAllSSOSessionsForUser(userId);

      // Assert
      expect(mockPrismaClient.sSOSession.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toBe(3);
    });
  });

  describe('deleteAllAppSessionsForUser', () => {
    it('debe eliminar todas las sesiones App de un usuario', async () => {
      // Arrange
      const userId = 'user-123';

      (mockPrismaClient.appSession.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      // Act
      const result = await repository.deleteAllAppSessionsForUser(userId);

      // Assert
      expect(mockPrismaClient.appSession.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toBe(5);
    });
  });

  describe('updateSSOSessionActivity', () => {
    it('debe actualizar timestamp de actividad', async () => {
      // Arrange
      const token = 'sso_v2_jti-123';

      (mockPrismaClient.sSOSession.update as jest.Mock).mockResolvedValue({});

      // Act
      await repository.updateSSOSessionActivity(token);

      // Assert
      expect(mockPrismaClient.sSOSession.update).toHaveBeenCalledWith({
        where: { sessionToken: token },
        data: { lastActivityAt: expect.any(Date) },
      });
    });
  });

  describe('updateAppSessionActivity', () => {
    it('debe actualizar timestamp de actividad', async () => {
      // Arrange
      const token = 'app_v2_jti-456';

      (mockPrismaClient.appSession.update as jest.Mock).mockResolvedValue({});

      // Act
      await repository.updateAppSessionActivity(token);

      // Assert
      expect(mockPrismaClient.appSession.update).toHaveBeenCalledWith({
        where: { sessionToken: token },
        data: { lastActivityAt: expect.any(Date) },
      });
    });
  });

  describe('extendSSOSession', () => {
    it('debe extender la expiración de la sesión', async () => {
      // Arrange
      const token = 'sso_v2_jti-123';
      const newExpiresAt = new Date('2099-12-31');

      (mockPrismaClient.sSOSession.update as jest.Mock).mockResolvedValue({});

      // Act
      await repository.extendSSOSession(token, newExpiresAt);

      // Assert
      expect(mockPrismaClient.sSOSession.update).toHaveBeenCalledWith({
        where: { sessionToken: token },
        data: {
          expiresAt: newExpiresAt,
          lastActivityAt: expect.any(Date),
        },
      });
    });
  });

  describe('extendAppSession', () => {
    it('debe extender la expiración de la sesión', async () => {
      // Arrange
      const token = 'app_v2_jti-456';
      const newExpiresAt = new Date('2099-12-31');

      (mockPrismaClient.appSession.update as jest.Mock).mockResolvedValue({});

      // Act
      await repository.extendAppSession(token, newExpiresAt);

      // Assert
      expect(mockPrismaClient.appSession.update).toHaveBeenCalledWith({
        where: { sessionToken: token },
        data: {
          expiresAt: newExpiresAt,
          lastActivityAt: expect.any(Date),
        },
      });
    });
  });

  describe('getActiveSSOSessionsForUser', () => {
    it('debe obtener sesiones SSO activas de un usuario', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        { id: '1', userId, sessionToken: 'sso_v2_jti-1', expiresAt: new Date('2099-01-01') },
        { id: '2', userId, sessionToken: 'sso_v2_jti-2', expiresAt: new Date('2099-01-01') },
      ];

      (mockPrismaClient.sSOSession.findMany as jest.Mock).mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getActiveSSOSessionsForUser(userId);

      // Assert
      expect(mockPrismaClient.sSOSession.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastActivityAt: 'desc' },
      });
      expect(result).toEqual(mockSessions);
    });
  });

  describe('getActiveAppSessionsForUser', () => {
    it('debe obtener sesiones App activas de un usuario', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        { id: '1', userId, sessionToken: 'app_v2_jti-1', expiresAt: new Date('2099-01-01') },
      ];

      (mockPrismaClient.appSession.findMany as jest.Mock).mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getActiveAppSessionsForUser(userId);

      // Assert
      expect(mockPrismaClient.appSession.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastActivityAt: 'desc' },
      });
      expect(result).toEqual(mockSessions);
    });
  });

  describe('cleanupExpiredSSOSessions', () => {
    it('debe eliminar sesiones SSO expiradas', async () => {
      // Arrange
      (mockPrismaClient.sSOSession.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      // Act
      const result = await repository.cleanupExpiredSSOSessions();

      // Assert
      expect(mockPrismaClient.sSOSession.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(result).toBe(10);
    });
  });

  describe('cleanupExpiredAppSessions', () => {
    it('debe eliminar sesiones App expiradas', async () => {
      // Arrange
      (mockPrismaClient.appSession.deleteMany as jest.Mock).mockResolvedValue({ count: 8 });

      // Act
      const result = await repository.cleanupExpiredAppSessions();

      // Assert
      expect(mockPrismaClient.appSession.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(result).toBe(8);
    });
  });
});
