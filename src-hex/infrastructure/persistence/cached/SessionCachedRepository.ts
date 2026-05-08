import { SSOSession, AppSession } from '../../../domain/entities/Session';
import { ISessionRepository, Session } from '../../../domain/repositories/ISessionRepository';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_SESSION      = 15 * 60; // 15 min
const TTL_SESSION_LIST =  5 * 60; //  5 min

interface SessionSnapshot {
  type: 'sso' | 'app';
  id: string; sessionToken: string; userId: string;
  ip: string | null; userAgent: string | null;
  expiresAt: string; createdAt: string; lastActivityAt: string;
  // AppSession extras
  tenantId?: string; appId?: string; role?: string; ssoSessionId?: string | null;
}

/**
 * SessionCachedRepository
 * Cache-Aside decorator for ISessionRepository.
 * Sessions are read on every authenticated request — Redis-first is critical.
 */
export class SessionCachedRepository implements ISessionRepository {
  constructor(
    private readonly db: ISessionRepository,
    private readonly cache: RedisCacheService<SessionSnapshot>,
    private readonly listCache: RedisCacheService<string[]>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: SessionId): Promise<Session | null> {
    const key = this.keys.session(id.value);
    const cached = await this.cache.get(key);
    if (cached) return this.fromSnapshot(cached);

    const session = await this.db.findById(id);
    if (session) await this.cache.set(key, this.toSnapshot(session), TTL_SESSION);
    return session;
  }

  async findByUser(userId: UserId): Promise<Session[]> {
    return this.db.findByUser(userId); // not cached — mutable list
  }

  async findActiveByUser(userId: UserId): Promise<Session[]> {
    return this.db.findActiveByUser(userId); // not cached — real-time status needed
  }

  async save(session: Session): Promise<void> {
    await this.db.save(session);
    await this.cache.set(this.keys.session(session.id.value), this.toSnapshot(session), TTL_SESSION);
  }

  async update(session: Session): Promise<void> {
    await this.db.update(session);
    // Refresh with updated state
    await this.cache.set(this.keys.session(session.id.value), this.toSnapshot(session), TTL_SESSION);
  }

  async delete(id: SessionId): Promise<void> {
    await this.db.delete(id);
    await this.cache.delete(this.keys.session(id.value));
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    const result = await this.db.deleteAllForUser(userId);
    await this.listCache.delete(this.keys.sessionsByUser(userId.value));
    return result;
  }

  async deleteExpired(): Promise<number> {
    return this.db.deleteExpired(); // always DB
  }

  async countActive(): Promise<number> {
    return this.db.countActive(); // always DB
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  private toSnapshot(session: Session): SessionSnapshot {
    const base: SessionSnapshot = {
      type: session instanceof SSOSession ? 'sso' : 'app',
      id: session.id.value,
      sessionToken: session.sessionToken,
      userId: session.userId.value,
      ip: session.ip,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
    };
    if (session instanceof AppSession) {
      base.tenantId = session.tenantId.value;
      base.appId = session.appId;
      base.role = session.role;
      base.ssoSessionId = session.ssoSessionId ?? null;
    }
    return base;
  }

  private fromSnapshot(snap: SessionSnapshot): Session {
    if (snap.type === 'sso') {
      return new SSOSession(
        SessionId.create(snap.id),
        snap.sessionToken,
        UserId.create(snap.userId),
        snap.ip,
        snap.userAgent,
        new Date(snap.expiresAt),
        new Date(snap.createdAt),
        new Date(snap.lastActivityAt)
      );
    }
    return new AppSession(
      SessionId.create(snap.id),
      snap.sessionToken,
      UserId.create(snap.userId),
      TenantId.create(snap.tenantId!),
      snap.appId!,
      snap.role!,
      snap.ip,
      snap.userAgent,
      new Date(snap.expiresAt),
      new Date(snap.createdAt),
      new Date(snap.lastActivityAt)
    );
  }
}
