import { CreateSessionInput } from '../../dto/input/CreateSessionInput';
import { SessionResult } from '../../dto/output/SessionResult';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { Session } from '../../../domain/entities/Session';

/**
 * ISessionPort
 * Interface exposing session management capabilities
 */
export interface ISessionPort {
  /**
   * Create a new session
   */
  createSession(input: CreateSessionInput): Promise<SessionResult>;

  /**
   * Validate session and return session data
   */
  validateSession(sessionId: SessionId): Promise<Session | null>;

  /**
   * Revoke a specific session
   */
  revokeSession(sessionId: SessionId): Promise<void>;

  /**
   * Revoke all sessions for a user
   */
  revokeAllUserSessions(userId: string): Promise<number>;

  /**
   * Get active sessions for a user
   */
  getActiveSessions(userId: string): Promise<Session[]>;
}
