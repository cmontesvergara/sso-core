import { EmailVerification, EmailVerificationStatus } from '../../../domain/entities/EmailVerification';
import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { Email } from '../../../domain/value-objects/Email';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_EV = 24 * 60 * 60; // 24 h — matches verification token lifetime

interface EVSnapshot {
  id: string; userId: string; email: string; token: string;
  createdAt: string; expiresAt: string;
  status: EmailVerificationStatus; verifiedAt: string | null;
}

export class EmailVerificationCachedRepository implements IEmailVerificationRepository {
  constructor(
    private readonly db: IEmailVerificationRepository,
    private readonly cache: RedisCacheService<EVSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: string): Promise<EmailVerification | null> {
    const cached = await this.cache.get(this.keys.emailVerification(id));
    if (cached) return this.fromSnapshot(cached);
    const ev = await this.db.findById(id);
    if (ev) await this.cache.set(this.keys.emailVerification(id), this.toSnapshot(ev), TTL_EV);
    return ev;
  }

  async findByToken(token: string): Promise<EmailVerification | null> {
    const evId = await this.lookupCache.get(this.keys.emailVerificationByToken(token));
    if (evId) {
      const cached = await this.cache.get(this.keys.emailVerification(evId));
      if (cached) return this.fromSnapshot(cached);
    }
    const ev = await this.db.findByToken(token);
    if (ev) {
      await Promise.all([
        this.cache.set(this.keys.emailVerification(ev.id), this.toSnapshot(ev), TTL_EV),
        this.lookupCache.set(this.keys.emailVerificationByToken(token), ev.id, TTL_EV),
      ]);
    }
    return ev;
  }

  async findPendingByUser(userId: UserId): Promise<EmailVerification | null> {
    const evId = await this.lookupCache.get(this.keys.emailVerificationByUser(userId.value));
    if (evId) {
      const cached = await this.cache.get(this.keys.emailVerification(evId));
      if (cached) return this.fromSnapshot(cached);
    }
    const ev = await this.db.findPendingByUser(userId);
    if (ev) {
      await Promise.all([
        this.cache.set(this.keys.emailVerification(ev.id), this.toSnapshot(ev), TTL_EV),
        this.lookupCache.set(this.keys.emailVerificationByUser(userId.value), ev.id, TTL_EV),
      ]);
    }
    return ev;
  }

  async save(verification: EmailVerification): Promise<void> {
    await this.db.save(verification);
    await Promise.all([
      this.cache.set(this.keys.emailVerification(verification.id), this.toSnapshot(verification), TTL_EV),
      this.lookupCache.set(this.keys.emailVerificationByToken(verification.token), verification.id, TTL_EV),
      this.lookupCache.set(this.keys.emailVerificationByUser(verification.userId.value), verification.id, TTL_EV),
    ]);
  }

  async update(verification: EmailVerification): Promise<void> {
    await this.db.update(verification);
    // Invalidate all lookup keys after status change (e.g. verified)
    await Promise.all([
      this.cache.delete(this.keys.emailVerification(verification.id)),
      this.lookupCache.delete(this.keys.emailVerificationByToken(verification.token)),
      this.lookupCache.delete(this.keys.emailVerificationByUser(verification.userId.value)),
    ]);
  }

  async delete(id: string): Promise<void> {
    const ev = await this.findById(id);
    await this.db.delete(id);
    const tasks: Promise<void>[] = [this.cache.delete(this.keys.emailVerification(id))];
    if (ev) {
      tasks.push(this.lookupCache.delete(this.keys.emailVerificationByToken(ev.token)));
      tasks.push(this.lookupCache.delete(this.keys.emailVerificationByUser(ev.userId.value)));
    }
    await Promise.all(tasks);
  }

  async deleteExpired(): Promise<number> { return this.db.deleteExpired(); }

  async isEmailVerified(email: Email): Promise<boolean> {
    return this.db.isEmailVerified(email); // always DB — authoritative
  }

  private toSnapshot(ev: EmailVerification): EVSnapshot {
    return {
      id: ev.id, userId: ev.userId.value, email: ev.email.value, token: ev.token,
      createdAt: ev.createdAt.toISOString(), expiresAt: ev.expiresAt.toISOString(),
      status: ev.status, verifiedAt: ev.verifiedAt?.toISOString() ?? null,
    };
  }

  private fromSnapshot(s: EVSnapshot): EmailVerification {
    return new EmailVerification(
      s.id, UserId.create(s.userId), Email.createUnsafe(s.email), s.token,
      new Date(s.createdAt), new Date(s.expiresAt), s.status,
      s.verifiedAt ? new Date(s.verifiedAt) : undefined
    );
  }
}
