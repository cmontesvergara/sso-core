import { PrismaClient, RefreshToken } from '@prisma/client';
import { Logger } from '../../utils/logger';
import { IRefreshTokenRepository } from '../interfaces/repository.interface';

/**
 * DTOs for Refresh Token operations
 */
export interface SaveRefreshTokenDTO {
  userId: string;
  tokenHash: string;
  clientId?: string | null;
  expiresAt: Date;
  previousTokenId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * RefreshTokenRepository - Implementation of IRefreshTokenRepository
 * Handles refresh token database operations
 */
export class RefreshTokenRepository implements IRefreshTokenRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Save a new refresh token
   */
  async saveRefreshToken(data: SaveRefreshTokenDTO): Promise<RefreshToken> {
    try {
      const token = await this.prisma.refreshToken.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          clientId: data.clientId,
          expiresAt: data.expiresAt,
          previousTokenId: data.previousTokenId,
          ip: data.ip,
          userAgent: data.userAgent,
        },
      });

      Logger.info('Refresh token saved', { tokenId: token.id, userId: data.userId });
      return token;
    } catch (error) {
      Logger.error('Failed to save refresh token', { error, userId: data.userId });
      throw error;
    }
  }

  /**
   * Find refresh token by hash
   */
  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    try {
      const token = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      return token;
    } catch (error) {
      Logger.error('Failed to find refresh token by hash', { error, tokenHash });
      throw error;
    }
  }

  /**
   * Revoke refresh token by ID
   */
  async revokeRefreshTokenById(id: string): Promise<void> {
    try {
      await this.prisma.refreshToken.update({
        where: { id },
        data: { revoked: true },
      });

      Logger.info('Refresh token revoked', { tokenId: id });
    } catch (error) {
      Logger.error('Failed to revoke refresh token', { error, tokenId: id });
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });

      Logger.info('All refresh tokens revoked for user', { userId });
    } catch (error) {
      Logger.error('Failed to revoke all refresh tokens', { error, userId });
      throw error;
    }
  }

  /**
   * Find refresh tokens by user ID
   */
  async findRefreshTokensByUser(userId: string): Promise<RefreshToken[]> {
    try {
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return tokens;
    } catch (error) {
      Logger.error('Failed to find refresh tokens for user', { error, userId });
      throw error;
    }
  }

  /**
   * Find active (non-revoked, non-expired) refresh tokens for a user
   */
  async findActiveRefreshTokensByUser(userId: string): Promise<RefreshToken[]> {
    try {
      const tokens = await this.prisma.refreshToken.findMany({
        where: {
          userId,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      return tokens;
    } catch (error) {
      Logger.error('Failed to find active refresh tokens for user', { error, userId });
      throw error;
    }
  }

  /**
   * Cleanup expired refresh tokens
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      Logger.info('Expired refresh tokens cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      Logger.error('Failed to cleanup expired refresh tokens', { error });
      throw error;
    }
  }

  /**
   * Count active refresh tokens for a user
   */
  async countActiveRefreshTokensForUser(userId: string): Promise<number> {
    try {
      return await this.prisma.refreshToken.count({
        where: {
          userId,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      Logger.error('Failed to count active refresh tokens', { error, userId });
      throw error;
    }
  }
}
