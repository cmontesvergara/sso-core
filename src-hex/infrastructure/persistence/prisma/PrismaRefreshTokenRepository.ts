import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';
import { UserId } from '../../../domain/value-objects/UserId';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaRefreshTokenRepository
 * Implementation of IRefreshTokenRepository using Prisma ORM
 * Aligned with Prisma schema: refresh_tokens table
 */
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: RefreshTokenId): Promise<RefreshToken | null> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: id.value },
    });
    return token ? this.mapToDomain(token) : null;
  }

  async findByHash(hash: string): Promise<RefreshToken | null> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    return token ? this.mapToDomain(token) : null;
  }

  async findBySession(sessionId: SessionId): Promise<RefreshToken[]> {
    // refresh_tokens table does not have a session FK in the current schema.
    // Tokens are linked to users only. Returning empty array — use findByUser() instead.
    void sessionId; // suppress unused warning
    return [];
  }

  async findByUser(userId: UserId): Promise<RefreshToken[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: userId.value },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((t: any) => this.mapToDomain(t));
  }

  async save(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: token.id.value,
        userId: token.userId.value,
        tokenHash: token.tokenHash,
        clientId: token.clientId,
        ip: token.ip,
        userAgent: token.userAgent,
        revoked: token.revoked,
        previousTokenId: token.previousTokenId?.value ?? null,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      },
    });
  }

  async update(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: token.id.value },
      data: {
        revoked: token.revoked,
        previousTokenId: token.previousTokenId?.value ?? null,
      },
    });
  }

  async delete(id: RefreshTokenId): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id: id.value } });
  }

  async deleteAllForSession(sessionId: SessionId): Promise<number> {
    // refresh_tokens table has no session FK. Callers should use deleteAllForUser()
    // or revoke individually. Returning 0 to satisfy the contract.
    void sessionId;
    return 0;
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId: userId.value },
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  async countActiveForUser(userId: UserId): Promise<number> {
    return this.prisma.refreshToken.count({
      where: {
        userId: userId.value,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private mapToDomain(raw: any): RefreshToken {
    return new RefreshToken(
      RefreshTokenId.create(raw.id),
      UserId.create(raw.userId),
      raw.tokenHash,
      raw.createdAt,
      raw.expiresAt,
      raw.revoked ?? false,
      raw.previousTokenId ? RefreshTokenId.create(raw.previousTokenId) : null,
      raw.clientId ?? null,
      raw.ip ?? null,
      raw.userAgent ?? null
    );
  }
}
