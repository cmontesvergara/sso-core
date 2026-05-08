import { RefreshToken } from '../../../domain/entities/RefreshToken';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { RefreshTokenId } from '../../../domain/value-objects/Ids';
import { UserId } from '../../../domain/value-objects/UserId';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_RT = 8 * 24 * 60 * 60; // 8 days — matches token lifetime

interface RTSnapshot {
  id: string; userId: string; tokenHash: string;
  createdAt: string; expiresAt: string; revoked: boolean;
  previousTokenId: string | null;
  clientId: string | null; ip: string | null; userAgent: string | null;
}

export class RefreshTokenCachedRepository implements IRefreshTokenRepository {
  constructor(
    private readonly db: IRefreshTokenRepository,
    private readonly cache: RedisCacheService<RTSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: RefreshTokenId): Promise<RefreshToken | null> {
    const cached = await this.cache.get(this.keys.refreshToken(id.value));
    if (cached) return this.fromSnapshot(cached);
    const token = await this.db.findById(id);
    if (token) await this.cache.set(this.keys.refreshToken(token.id.value), this.toSnapshot(token), TTL_RT);
    return token;
  }

  async findByHash(hash: string): Promise<RefreshToken | null> {
    const tokenId = await this.lookupCache.get(this.keys.refreshTokenByHash(hash));
    if (tokenId) {
      const cached = await this.cache.get(this.keys.refreshToken(tokenId));
      if (cached) return this.fromSnapshot(cached);
    }
    const token = await this.db.findByHash(hash);
    if (token) {
      await Promise.all([
        this.cache.set(this.keys.refreshToken(token.id.value), this.toSnapshot(token), TTL_RT),
        this.lookupCache.set(this.keys.refreshTokenByHash(hash), token.id.value, TTL_RT),
      ]);
    }
    return token;
  }

  async findBySession(sessionId: SessionId): Promise<RefreshToken[]> {
    return this.db.findBySession(sessionId);
  }

  async findByUser(userId: UserId): Promise<RefreshToken[]> {
    return this.db.findByUser(userId);
  }

  async save(token: RefreshToken): Promise<void> {
    await this.db.save(token);
    await Promise.all([
      this.cache.set(this.keys.refreshToken(token.id.value), this.toSnapshot(token), TTL_RT),
      this.lookupCache.set(this.keys.refreshTokenByHash(token.tokenHash), token.id.value, TTL_RT),
    ]);
  }

  async update(token: RefreshToken): Promise<void> {
    await this.db.update(token);
    // Re-write with fresh revocation state
    await this.cache.set(this.keys.refreshToken(token.id.value), this.toSnapshot(token), TTL_RT);
  }

  async delete(id: RefreshTokenId): Promise<void> {
    const token = await this.findById(id);
    await this.db.delete(id);
    const tasks: Promise<void>[] = [this.cache.delete(this.keys.refreshToken(id.value))];
    if (token) tasks.push(this.lookupCache.delete(this.keys.refreshTokenByHash(token.tokenHash)));
    await Promise.all(tasks);
  }

  async deleteAllForSession(sessionId: SessionId): Promise<number> {
    return this.db.deleteAllForSession(sessionId);
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    return this.db.deleteAllForUser(userId);
  }

  async deleteExpired(): Promise<number> { return this.db.deleteExpired(); }
  async countActiveForUser(userId: UserId): Promise<number> { return this.db.countActiveForUser(userId); }

  private toSnapshot(t: RefreshToken): RTSnapshot {
    return {
      id: t.id.value, userId: t.userId.value, tokenHash: t.tokenHash,
      createdAt: t.createdAt.toISOString(), expiresAt: t.expiresAt.toISOString(),
      revoked: t.revoked, previousTokenId: t.previousTokenId?.value ?? null,
      clientId: t.clientId, ip: t.ip, userAgent: t.userAgent,
    };
  }

  private fromSnapshot(s: RTSnapshot): RefreshToken {
    return new RefreshToken(
      RefreshTokenId.create(s.id), UserId.create(s.userId), s.tokenHash,
      new Date(s.createdAt), new Date(s.expiresAt), s.revoked,
      s.previousTokenId ? RefreshTokenId.create(s.previousTokenId) : null,
      s.clientId, s.ip, s.userAgent
    );
  }
}
