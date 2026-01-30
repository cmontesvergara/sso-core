import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import {
    cleanupExpiredSSOSessions,
    createSSOSession as createSSOSessionRepo,
    deleteAllSSOSessionsForUser,
    deleteSSOSession,
    deleteSSOSessionById,
    extendSSOSession,
    findSSOSessionByToken,
    getActiveSSOSessionsForUser,
    updateSSOSessionActivity,
} from '../repositories/ssoSessionRepo.prisma';
import { Logger } from '../utils/logger';

/**
 * SSOSession Service
 * Manages SSO portal sessions (cookie-based authentication)
 */

// Default 24 hours
const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60;

// Refresh if less than 1 hour remaining
const SESSION_REFRESH_THRESHOLD_SECONDS = 60 * 60;

export class SSOSessionService {
  private static instance: SSOSessionService;

  private constructor() {}

  static getInstance(): SSOSessionService {
    if (!SSOSessionService.instance) {
      SSOSessionService.instance = new SSOSessionService();
    }
    return SSOSessionService.instance;
  }

  /**
   * Create new SSO session
   * 
   * @param userId - User ID
   * @param metadata - Optional session metadata (ip, user_agent)
   * @returns Session token and expiration
   */
  async createSession(
    userId: string,
    metadata?: { ip?: string; userAgent?: string }
  ) {
    // Generate session token
    const sessionToken = `sso_${uuidv4().replace(/-/g, '')}`;

    // Calculate expiration
    const ttl = Config.get('sso_session_ttl', DEFAULT_SESSION_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Create session in database
    const session = await createSSOSessionRepo({
      session_token: sessionToken,
      user_id: userId,
      ip: metadata?.ip,
      user_agent: metadata?.userAgent,
      expires_at: expiresAt,
    });

    Logger.info('SSO session created', {
      sessionId: session.id,
      userId,
      expiresAt,
    });

    return {
      sessionToken,
      expiresAt,
      maxAge: ttl * 1000, // milliseconds for cookie
    };
  }

  /**
   * Validate SSO session
   * 
   * - Checks if session exists
   * - Validates not expired
   * - Updates last activity
   * - Auto-refreshes if near expiration
   * 
   * @param sessionToken - Session token from cookie
   * @returns User information
   * @throws Error if validation fails
   */
  async validateSession(sessionToken: string) {
    // Find session
    const session = await findSSOSessionByToken(sessionToken);

    if (!session) {
      Logger.warn('SSO session not found', {
        token: sessionToken.substring(0, 15) + '...',
      });
      throw new Error('INVALID_SESSION');
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      Logger.warn('SSO session expired', {
        sessionId: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      });
      // Clean up expired session
      await deleteSSOSession(sessionToken);
      throw new Error('SESSION_EXPIRED');
    }

    // Check user status
    if (session.user.userStatus !== 'active') {
      Logger.warn('User account not active', {
        userId: session.userId,
        status: session.user.userStatus,
      });
      throw new Error('ACCOUNT_NOT_ACTIVE');
    }

    // Update last activity
    await updateSSOSessionActivity(sessionToken);

    // Auto-refresh if near expiration
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD_SECONDS * 1000) {
      const ttl = Config.get('sso_session_ttl', DEFAULT_SESSION_TTL_SECONDS);
      const newExpiresAt = new Date(Date.now() + ttl * 1000);
      await extendSSOSession(sessionToken, newExpiresAt);
      
      Logger.info('SSO session auto-refreshed', {
        sessionId: session.id,
        userId: session.userId,
        newExpiresAt,
      });
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      userStatus: session.user.userStatus,
      systemRole: session.user.systemRole,
    };
  }

  /**
   * Destroy SSO session (logout)
   * 
   * @param sessionToken - Session token to destroy
   */
  async destroySession(sessionToken: string): Promise<void> {
    await deleteSSOSession(sessionToken);
    Logger.info('SSO session destroyed', {
      token: sessionToken.substring(0, 15) + '...',
    });
  }

  /**
   * Logout from all devices
   * Destroys all SSO sessions for a user
   * 
   * @param userId - User ID
   * @returns Number of sessions destroyed
   */
  async logoutFromAllDevices(userId: string): Promise<number> {
    const count = await deleteAllSSOSessionsForUser(userId);
    Logger.info('User logged out from all devices', {
      userId,
      sessionsDestroyed: count,
    });
    return count;
  }

  /**
   * Get active sessions for user
   * Used for "Active Sessions" UI
   * 
   * @param userId - User ID
   * @returns List of active sessions
   */
  async getActiveSessions(userId: string) {
    return await getActiveSSOSessionsForUser(userId);
  }

  /**
   * Revoke specific session
   * Used for "Sign out this device" functionality
   * 
   * @param sessionId - Session ID to revoke
   */
  async revokeSession(sessionId: string): Promise<void> {
    await deleteSSOSessionById(sessionId);
    Logger.info('SSO session revoked', { sessionId });
  }

  /**
   * Cleanup expired sessions
   * Should be called periodically
   * 
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    const count = await cleanupExpiredSSOSessions();
    Logger.info(`Cleaned up ${count} expired SSO sessions`);
    return count;
  }

  /**
   * Refresh session expiration
   * Manually extend session lifetime
   * 
   * @param sessionToken - Session token
   * @param additionalSeconds - Additional time to add (optional)
   */
  async refreshSession(sessionToken: string, additionalSeconds?: number): Promise<void> {
    const ttl = additionalSeconds || Config.get('sso_session_ttl', DEFAULT_SESSION_TTL_SECONDS);
    const newExpiresAt = new Date(Date.now() + ttl * 1000);
    
    await extendSSOSession(sessionToken, newExpiresAt);
    
    Logger.info('SSO session refreshed', {
      token: sessionToken.substring(0, 15) + '...',
      newExpiresAt,
    });
  }
}

// Singleton export
export const SSOSession = SSOSessionService.getInstance();

// Schedule cleanup job (every 30 minutes)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await SSOSession.cleanupExpiredSessions();
    } catch (error) {
      Logger.error('Failed to cleanup SSO sessions', error);
    }
  }, 30 * 60 * 1000); // 30 minutes
}
