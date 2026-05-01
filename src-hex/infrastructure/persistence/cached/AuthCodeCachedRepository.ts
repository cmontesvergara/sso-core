import { AuthCode } from '../../../domain/entities/AuthCode';
import { IAuthCodeRepository } from '../../../domain/repositories/IAuthCodeRepository';
import { AuthCodeId } from '../../../domain/value-objects/Ids';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_CODE = 5 * 60; // 5 min — matches auth code lifetime

interface AuthCodeSnapshot {
  id: string; code: string; userId: string; tenantId: string;
  appId: string; redirectUri: string; expiresAt: string; createdAt: string;
  used: boolean; codeChallenge: string | null; codeChallengeMethod: string | null;
  state: string | null; nonce: string | null; ssoSessionId: string | null;
}

export class AuthCodeCachedRepository implements IAuthCodeRepository {
  constructor(
    private readonly db: IAuthCodeRepository,
    private readonly cache: RedisCacheService<AuthCodeSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: AuthCodeId): Promise<AuthCode | null> {
    const cached = await this.cache.get(this.keys.authCode(id.value));
    if (cached) return this.fromSnapshot(cached);
    const ac = await this.db.findById(id);
    if (ac) await this.cache.set(this.keys.authCode(ac.id.value), this.toSnapshot(ac), TTL_CODE);
    return ac;
  }

  async findByCode(code: string): Promise<AuthCode | null> {
    const codeId = await this.lookupCache.get(this.keys.authCodeByCode(code));
    if (codeId) {
      const cached = await this.cache.get(this.keys.authCode(codeId));
      if (cached) return this.fromSnapshot(cached);
    }
    const ac = await this.db.findByCode(code);
    if (ac) {
      await Promise.all([
        this.cache.set(this.keys.authCode(ac.id.value), this.toSnapshot(ac), TTL_CODE),
        this.lookupCache.set(this.keys.authCodeByCode(code), ac.id.value, TTL_CODE),
      ]);
    }
    return ac;
  }

  async save(authCode: AuthCode): Promise<void> {
    await this.db.save(authCode);
    await Promise.all([
      this.cache.set(this.keys.authCode(authCode.id.value), this.toSnapshot(authCode), TTL_CODE),
      this.lookupCache.set(this.keys.authCodeByCode(authCode.code), authCode.id.value, TTL_CODE),
    ]);
  }

  async update(authCode: AuthCode): Promise<void> {
    await this.db.update(authCode);
    // Invalidate after use
    await Promise.all([
      this.cache.delete(this.keys.authCode(authCode.id.value)),
      this.lookupCache.delete(this.keys.authCodeByCode(authCode.code)),
    ]);
  }

  async delete(id: AuthCodeId): Promise<void> {
    const ac = await this.findById(id);
    await this.db.delete(id);
    const tasks: Promise<void>[] = [this.cache.delete(this.keys.authCode(id.value))];
    if (ac) tasks.push(this.lookupCache.delete(this.keys.authCodeByCode(ac.code)));
    await Promise.all(tasks);
  }

  async deleteExpired(): Promise<number> { return this.db.deleteExpired(); }
  async findPendingByUser(userId: UserId): Promise<AuthCode[]> { return this.db.findPendingByUser(userId); }
  async countActiveForUserInTenant(userId: UserId, tenantId: TenantId): Promise<number> {
    return this.db.countActiveForUserInTenant(userId, tenantId);
  }

  private toSnapshot(a: AuthCode): AuthCodeSnapshot {
    return {
      id: a.id.value, code: a.code, userId: a.userId.value,
      tenantId: a.tenantId.value, appId: a.appId, redirectUri: a.redirectUri,
      expiresAt: a.expiresAt.toISOString(), createdAt: a.createdAt.toISOString(),
      used: a.used, codeChallenge: a.codeChallenge, codeChallengeMethod: a.codeChallengeMethod,
      state: a.state, nonce: a.nonce, ssoSessionId: a.ssoSessionId,
    };
  }

  private fromSnapshot(s: AuthCodeSnapshot): AuthCode {
    return new AuthCode(
      AuthCodeId.create(s.id), s.code,
      UserId.create(s.userId), TenantId.create(s.tenantId),
      s.appId, s.redirectUri,
      new Date(s.expiresAt), new Date(s.createdAt), s.used,
      s.codeChallenge, s.codeChallengeMethod, s.state, s.nonce, s.ssoSessionId
    );
  }
}
