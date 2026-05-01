import { OtpSecret, OtpSecretStatus } from '../../../domain/entities/OtpSecret';
import { IOtpRepository } from '../../../domain/repositories/IOtpRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_OTP = 60 * 60; // 1 h

interface OtpSnapshot {
  id: string; userId: string; secret: string; backupCodes: string[];
  status: OtpSecretStatus; createdAt: string;
  lastUsedAt: string | null; verifiedAt: string | null;
}

export class OtpCachedRepository implements IOtpRepository {
  constructor(
    private readonly db: IOtpRepository,
    private readonly cache: RedisCacheService<OtpSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: string): Promise<OtpSecret | null> {
    const cached = await this.cache.get(this.keys.otpSecret(id));
    if (cached) return this.fromSnapshot(cached);
    const otp = await this.db.findById(id);
    if (otp) await this.cache.set(this.keys.otpSecret(id), this.toSnapshot(otp), TTL_OTP);
    return otp;
  }

  async findActiveByUser(userId: UserId): Promise<OtpSecret | null> {
    const otpId = await this.lookupCache.get(this.keys.otpSecretByUser(userId.value));
    if (otpId) {
      const cached = await this.cache.get(this.keys.otpSecret(otpId));
      if (cached) return this.fromSnapshot(cached);
    }
    const otp = await this.db.findActiveByUser(userId);
    if (otp) {
      await Promise.all([
        this.cache.set(this.keys.otpSecret(otp.id), this.toSnapshot(otp), TTL_OTP),
        this.lookupCache.set(this.keys.otpSecretByUser(userId.value), otp.id, TTL_OTP),
      ]);
    }
    return otp;
  }

  async save(secret: OtpSecret): Promise<void> {
    await this.db.save(secret);
    await Promise.all([
      this.cache.set(this.keys.otpSecret(secret.id), this.toSnapshot(secret), TTL_OTP),
      this.lookupCache.set(this.keys.otpSecretByUser(secret.userId.value), secret.id, TTL_OTP),
    ]);
  }

  async update(secret: OtpSecret): Promise<void> {
    await this.db.update(secret);
    await Promise.all([
      this.cache.set(this.keys.otpSecret(secret.id), this.toSnapshot(secret), TTL_OTP),
      this.lookupCache.set(this.keys.otpSecretByUser(secret.userId.value), secret.id, TTL_OTP),
    ]);
  }

  async delete(id: string): Promise<void> {
    const otp = await this.findById(id);
    await this.db.delete(id);
    const tasks: Promise<void>[] = [this.cache.delete(this.keys.otpSecret(id))];
    if (otp) tasks.push(this.lookupCache.delete(this.keys.otpSecretByUser(otp.userId.value)));
    await Promise.all(tasks);
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    const result = await this.db.deleteAllForUser(userId);
    await this.lookupCache.delete(this.keys.otpSecretByUser(userId.value));
    return result;
  }

  async isEnabledForUser(userId: UserId): Promise<boolean> {
    const inCache = await this.lookupCache.exists(this.keys.otpSecretByUser(userId.value));
    if (inCache) return true;
    return this.db.isEnabledForUser(userId);
  }

  private toSnapshot(o: OtpSecret): OtpSnapshot {
    return {
      id: o.id, userId: o.userId.value, secret: o.secret,
      backupCodes: [...o.backupCodes], status: o.status,
      createdAt: o.createdAt.toISOString(),
      lastUsedAt: o.lastUsedAt?.toISOString() ?? null,
      verifiedAt: o.verifiedAt?.toISOString() ?? null,
    };
  }

  private fromSnapshot(s: OtpSnapshot): OtpSecret {
    return new OtpSecret(
      s.id, UserId.create(s.userId), s.secret, s.backupCodes, s.status,
      new Date(s.createdAt),
      s.lastUsedAt ? new Date(s.lastUsedAt) : undefined,
      s.verifiedAt ? new Date(s.verifiedAt) : undefined
    );
  }
}
