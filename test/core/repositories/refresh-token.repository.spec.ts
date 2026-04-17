/**
 * Tests para RefreshTokenRepository
 * Cubre: saveRefreshToken, findRefreshTokenByHash, revokeRefreshTokenById,
 * revokeAllRefreshTokensForUser, findRefreshTokensByUser, findActiveRefreshTokensByUser,
 * cleanupExpiredRefreshTokens, countActiveRefreshTokensForUser
 */

import { RefreshTokenRepository, SaveRefreshTokenDTO } from '../../../src/core/repositories/refresh-token.repository';

// Mock del cliente Prisma
const mockPrismaClient: any = {
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
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

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    // Resetear mocks del cliente Prisma
    Object.keys(mockPrismaClient.refreshToken).forEach((key) => {
      (mockPrismaClient.refreshToken[key] as jest.Mock).mockClear();
    });

    repository = new RefreshTokenRepository(mockPrismaClient);
  });

  describe('saveRefreshToken', () => {
    it('debe guardar un refresh token exitosamente', async () => {
      // Arrange
      const dto: SaveRefreshTokenDTO = {
        userId: 'user-123',
        tokenHash: 'hash-123',
        clientId: 'app_v2_jti-123',
        expiresAt: new Date('2099-01-01'),
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      const mockToken = {
        id: '1',
        ...dto,
        createdAt: new Date(),
        revoked: false,
        previousTokenId: null,
      };

      (mockPrismaClient.refreshToken.create as jest.Mock).mockResolvedValue(mockToken);

      // Act
      const result = await repository.saveRefreshToken(dto);

      // Assert
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(result).toEqual(mockToken);
    });

    it('debe guardar sin clientId, ip, userAgent opcionales', async () => {
      // Arrange
      const dto: SaveRefreshTokenDTO = {
        userId: 'user-123',
        tokenHash: 'hash-123',
        expiresAt: new Date('2099-01-01'),
      };

      const mockToken = {
        id: '1',
        ...dto,
        clientId: null,
        ip: null,
        userAgent: null,
        createdAt: new Date(),
        revoked: false,
        previousTokenId: null,
      };

      (mockPrismaClient.refreshToken.create as jest.Mock).mockResolvedValue(mockToken);

      // Act
      await repository.saveRefreshToken(dto);

      // Assert
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalledWith({
        data: dto,
      });
    });
  });

  describe('findRefreshTokenByHash', () => {
    it('debe encontrar un token por hash', async () => {
      // Arrange
      const tokenHash = 'hash-123';
      const mockToken = {
        id: '1',
        userId: 'user-123',
        tokenHash,
        expiresAt: new Date('2099-01-01'),
        revoked: false,
        createdAt: new Date(),
        clientId: null,
        previousTokenId: null,
        ip: null,
        userAgent: null,
      };

      (mockPrismaClient.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockToken);

      // Act
      const result = await repository.findRefreshTokenByHash(tokenHash);

      // Assert
      expect(mockPrismaClient.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
      });
      expect(result).toEqual(mockToken);
    });

    it('debe retornar null si token no existe', async () => {
      // Arrange
      (mockPrismaClient.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findRefreshTokenByHash('hash-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshTokenById', () => {
    it('debe revocar un token por ID', async () => {
      // Arrange
      const id = '1';

      (mockPrismaClient.refreshToken.update as jest.Mock).mockResolvedValue({
        id,
        revoked: true,
      });

      // Act
      await repository.revokeRefreshTokenById(id);

      // Assert
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { id },
        data: { revoked: true },
      });
    });
  });

  describe('revokeAllRefreshTokensForUser', () => {
    it('debe revocar todos los tokens de un usuario', async () => {
      // Arrange
      const userId = 'user-123';

      (mockPrismaClient.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      // Act
      await repository.revokeAllRefreshTokensForUser(userId);

      // Assert
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { revoked: true },
      });
    });
  });

  describe('findRefreshTokensByUser', () => {
    it('debe encontrar todos los tokens de un usuario', async () => {
      // Arrange
      const userId = 'user-123';
      const mockTokens = [
        { id: '1', userId, tokenHash: 'hash-1', createdAt: new Date() },
        { id: '2', userId, tokenHash: 'hash-2', createdAt: new Date() },
      ];

      (mockPrismaClient.refreshToken.findMany as jest.Mock).mockResolvedValue(mockTokens);

      // Act
      const result = await repository.findRefreshTokensByUser(userId);

      // Assert
      expect(mockPrismaClient.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('findActiveRefreshTokensByUser', () => {
    it('debe encontrar tokens activos (no revocados, no expirados)', async () => {
      // Arrange
      const userId = 'user-123';
      const mockTokens = [
        {
          id: '1',
          userId,
          tokenHash: 'hash-1',
          revoked: false,
          expiresAt: new Date('2099-01-01'),
          createdAt: new Date(),
        },
      ];

      (mockPrismaClient.refreshToken.findMany as jest.Mock).mockResolvedValue(mockTokens);

      // Act
      const result = await repository.findActiveRefreshTokensByUser(userId);

      // Assert
      expect(mockPrismaClient.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          revoked: false,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('cleanupExpiredRefreshTokens', () => {
    it('debe eliminar tokens expirados', async () => {
      // Arrange
      (mockPrismaClient.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      // Act
      const result = await repository.cleanupExpiredRefreshTokens();

      // Assert
      expect(mockPrismaClient.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
      expect(result).toBe(5);
    });
  });

  describe('countActiveRefreshTokensForUser', () => {
    it('debe contar tokens activos de un usuario', async () => {
      // Arrange
      (mockPrismaClient.refreshToken.count as jest.Mock).mockResolvedValue(3);

      // Act
      const result = await repository.countActiveRefreshTokensForUser('user-123');

      // Assert
      expect(mockPrismaClient.refreshToken.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revoked: false,
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toBe(3);
    });
  });
});
