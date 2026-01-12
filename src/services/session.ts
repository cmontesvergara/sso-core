import { v4 as uuidv4 } from 'uuid';
import { Repository } from '../database/types';
import { Session } from '../types';

/**
 * Session Service for session management
 */
export class SessionService {
  private static instance: SessionService;

  private sessionRepository: Repository<Session>;

  private constructor(sessionRepository: Repository<Session>) {
    this.sessionRepository = sessionRepository;
  }

  static getInstance(sessionRepository: Repository<Session>): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService(sessionRepository);
    }
    return SessionService.instance;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
    tenantId?: string
  ): Promise<Session> {
    const session: Session = {
      sessionId: uuidv4(),
      userId,
      tenantId,
      accessToken,
      refreshToken,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.sessionRepository.create(session);
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<Session | null> {
    return this.sessionRepository.findById(sessionId);
  }

  /**
   * Get session by user ID
   */
  async getSessionByUserId(userId: string): Promise<Session | null> {
    return this.sessionRepository.findOne({ userId } as Partial<Session>);
  }

  /**
   * Verify session is valid and not expired
   */
  async verifySession(sessionId: string): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session) return false;
    return session.expiresAt > new Date();
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    return this.sessionRepository.delete(sessionId);
  }

  /**
   * Refresh session
   */
  async refreshSession(sessionId: string, newAccessToken: string, newRefreshToken: string): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    return this.sessionRepository.update(sessionId, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      updatedAt: new Date(),
    } as Partial<Session>);
  }
}
