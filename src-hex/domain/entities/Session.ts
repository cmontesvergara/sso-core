import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { TenantId } from '../value-objects/TenantId';
// import { DeviceFingerprint } from '../value-objects/DeviceFingerprint';

/**
 * SessionBase
 * Common fields for all session types
 * Aligned with Prisma schema
 */
export abstract class SessionBase {
  constructor(
    protected readonly _id: SessionId,
    protected readonly _sessionToken: string,
    protected readonly _userId: UserId,
    protected readonly _ip: string | null,
    protected readonly _userAgent: string | null,
    protected readonly _expiresAt: Date,
    protected readonly _createdAt: Date,
    protected readonly _lastActivityAt: Date
  ) { }

  get id(): SessionId {
    return this._id;
  }

  get sessionToken(): string {
    return this._sessionToken;
  }

  get userId(): UserId {
    return this._userId;
  }

  get ip(): string | null {
    return this._ip;
  }

  get userAgent(): string | null {
    return this._userAgent;
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get lastActivityAt(): Date {
    return new Date(this._lastActivityAt);
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Update last activity timestamp
   */
  touch(): this {
    // This would require making lastActivityAt mutable or returning new instance
    // For now, just a placeholder
    return this;
  }
}

/**
 * SSOSession Entity
 * Represents an SSO portal session
 * Matches Prisma: sso_sessions table
 * Immutable
 */
export class SSOSession extends SessionBase {
  constructor(
    id: SessionId,
    sessionToken: string,
    userId: UserId,
    ip: string | null,
    userAgent: string | null,
    expiresAt: Date,
    createdAt: Date,
    lastActivityAt: Date
  ) {
    super(id, sessionToken, userId, ip, userAgent, expiresAt, createdAt, lastActivityAt);
    Object.freeze(this);
  }

  /**
   * Create a copy with updated last activity
   */
  withLastActivity(timestamp: Date = new Date()): SSOSession {
    return new SSOSession(
      this._id,
      this._sessionToken,
      this._userId,
      this._ip,
      this._userAgent,
      this._expiresAt,
      this._createdAt,
      timestamp
    );
  }
}

/**
 * AppSession Entity
 * Represents an application session
 * Matches Prisma: app_sessions table
 * Immutable
 */
export class AppSession extends SessionBase {
  constructor(
    id: SessionId,
    sessionToken: string,
    userId: UserId,
    tenantId: TenantId,
    appId: string,
    role: string,
    ip: string | null,
    userAgent: string | null,
    expiresAt: Date,
    createdAt: Date,
    lastActivityAt: Date,
    private readonly _ssoSessionId?: string
  ) {
    super(id, sessionToken, userId, ip, userAgent, expiresAt, createdAt, lastActivityAt);
    Object.freeze(this);
  }

  get tenantId(): TenantId {
    // SSOSessions don't have tenantId, AppSessions do
    // This getter is specific to AppSession
    return (this as any)._tenantId;
  }

  get appId(): string {
    return (this as any)._appId;
  }

  get role(): string {
    return (this as any)._role;
  }

  get ssoSessionId(): string | undefined {
    return this._ssoSessionId;
  }

  /**
   * Create a copy with updated last activity
   */
  withLastActivity(timestamp: Date = new Date()): AppSession {
    return new AppSession(
      this._id,
      this._sessionToken,
      this._userId,
      this.tenantId,
      this.appId,
      this.role,
      this._ip,
      this._userAgent,
      this._expiresAt,
      this._createdAt,
      timestamp,
      this._ssoSessionId
    );
  }
}

// Type union for both session types
export type Session = SSOSession | AppSession;
