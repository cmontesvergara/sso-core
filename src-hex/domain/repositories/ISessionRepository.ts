import { SSOSession, AppSession } from '../entities/Session';
import { SessionId } from '../value-objects/SessionId';
import { UserId } from '../value-objects/UserId';

/**
 * Session type union
 */
export type Session = SSOSession | AppSession;

/**
 * ISessionRepository
 * Interface for Session persistence operations
 * Domain layer - no implementation details
 */
export interface ISessionRepository {
  /**
   * Find session by ID
   */
  findById(id: SessionId): Promise<Session | null>;

  /**
   * Find sessions by user
   */
  findByUser(userId: UserId): Promise<Session[]>;

  /**
   * Find active sessions by user
   */
  findActiveByUser(userId: UserId): Promise<Session[]>;

  /**
   * Save a new session
   */
  save(session: Session): Promise<void>;

  /**
   * Update an existing session
   */
  update(session: Session): Promise<void>;

  /**
   * Delete a session
   */
  delete(id: SessionId): Promise<void>;

  /**
   * Delete all sessions for a user
   */
  deleteAllForUser(userId: UserId): Promise<number>;

  /**
   * Delete expired sessions
   */
  deleteExpired(): Promise<number>;

  /**
   * Count active sessions
   */
  countActive(): Promise<number>;
}
