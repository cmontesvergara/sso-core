import { PrismaClient, SSOSession, AppSession } from '@prisma/client';
import { Logger } from '../../utils/logger';
import { ISessionRepository } from '../interfaces/repository.interface';

/**
 * DTOs for Session operations
 */
export interface CreateSSOSessionDTO {
  sessionToken: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}

export interface CreateAppSessionDTO {
  sessionToken: string;
  appId: string;
  userId: string;
  tenantId: string;
  role: string;
  ip?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}

export interface SessionWithUser {
  id: string;
  sessionToken: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userStatus: string;
    systemRole: string;
  };
}

export interface AppSessionWithRelations {
  id: string;
  sessionToken: string;
  appId: string;
  userId: string;
  tenantId: string;
  role: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * SessionRepository - Implementation of ISessionRepository
 * Handles SSO and App session database operations
 */
export class SessionRepository implements ISessionRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new SSO session
   */
  async createSSOSession(data: CreateSSOSessionDTO): Promise<SSOSession> {
    try {
      const session = await this.prisma.sSOSession.create({
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          ip: data.ip,
          userAgent: data.userAgent,
          expiresAt: data.expiresAt,
          lastActivityAt: new Date(),
        },
      });

      Logger.info('SSO session created', { sessionId: session.id, userId: data.userId });
      return session;
    } catch (error) {
      Logger.error('Failed to create SSO session', { error, userId: data.userId });
      throw error;
    }
  }

  /**
   * Create a new App session
   */
  async createAppSession(data: CreateAppSessionDTO): Promise<AppSession> {
    try {
      const session = await this.prisma.appSession.create({
        data: {
          sessionToken: data.sessionToken,
          appId: data.appId,
          userId: data.userId,
          tenantId: data.tenantId,
          role: data.role,
          ip: data.ip,
          userAgent: data.userAgent,
          expiresAt: data.expiresAt,
          lastActivityAt: new Date(),
        },
      });

      Logger.info('App session created', { sessionId: session.id, appId: data.appId, userId: data.userId });
      return session;
    } catch (error) {
      Logger.error('Failed to create App session', { error, appId: data.appId, userId: data.userId });
      throw error;
    }
  }

  /**
   * Find SSO session by token with user data
   */
  async findSSOSessionByToken(token: string): Promise<SessionWithUser | null> {
    try {
      const session = await this.prisma.sSOSession.findUnique({
        where: { sessionToken: token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              userStatus: true,
              systemRole: true,
            },
          },
        },
      });

      return session as SessionWithUser | null;
    } catch (error) {
      Logger.error('Failed to find SSO session', { error, token });
      throw error;
    }
  }

  /**
   * Find App session by token with user and tenant data
   */
  async findAppSessionByToken(token: string): Promise<AppSession | null> {
    try {
      const session = await this.prisma.appSession.findUnique({
        where: { sessionToken: token },
      });

      return session;
    } catch (error) {
      Logger.error('Failed to find App session', { error, token });
      throw error;
    }
  }

  /**
   * Delete SSO session by token
   */
  async deleteSSOSession(token: string): Promise<void> {
    try {
      await this.prisma.sSOSession.delete({
        where: { sessionToken: token },
      });

      Logger.info('SSO session deleted', { token });
    } catch (error) {
      Logger.error('Failed to delete SSO session', { error, token });
      throw error;
    }
  }

  /**
   * Delete App session by token
   */
  async deleteAppSession(token: string): Promise<void> {
    try {
      await this.prisma.appSession.delete({
        where: { sessionToken: token },
      });

      Logger.info('App session deleted', { token });
    } catch (error) {
      Logger.error('Failed to delete App session', { error, token });
      throw error;
    }
  }

  /**
   * Delete all SSO sessions for a user
   */
  async deleteAllSSOSessionsForUser(userId: string): Promise<number> {
    try {
      const result = await this.prisma.sSOSession.deleteMany({
        where: { userId },
      });

      Logger.info('All SSO sessions deleted for user', { userId, count: result.count });
      return result.count;
    } catch (error) {
      Logger.error('Failed to delete all SSO sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Delete all App sessions for a user
   */
  async deleteAllAppSessionsForUser(userId: string): Promise<number> {
    try {
      const result = await this.prisma.appSession.deleteMany({
        where: { userId },
      });

      Logger.info('All App sessions deleted for user', { userId, count: result.count });
      return result.count;
    } catch (error) {
      Logger.error('Failed to delete all App sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Update SSO session activity timestamp
   */
  async updateSSOSessionActivity(token: string): Promise<void> {
    try {
      await this.prisma.sSOSession.update({
        where: { sessionToken: token },
        data: { lastActivityAt: new Date() },
      });
    } catch (error) {
      Logger.error('Failed to update SSO session activity', { error, token });
      throw error;
    }
  }

  /**
   * Update App session activity timestamp
   */
  async updateAppSessionActivity(token: string): Promise<void> {
    try {
      await this.prisma.appSession.update({
        where: { sessionToken: token },
        data: { lastActivityAt: new Date() },
      });
    } catch (error) {
      Logger.error('Failed to update App session activity', { error, token });
      throw error;
    }
  }

  /**
   * Extend SSO session expiration
   */
  async extendSSOSession(token: string, newExpiresAt: Date): Promise<void> {
    try {
      await this.prisma.sSOSession.update({
        where: { sessionToken: token },
        data: {
          expiresAt: newExpiresAt,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      Logger.error('Failed to extend SSO session', { error, token });
      throw error;
    }
  }

  /**
   * Extend App session expiration
   */
  async extendAppSession(token: string, newExpiresAt: Date): Promise<void> {
    try {
      await this.prisma.appSession.update({
        where: { sessionToken: token },
        data: {
          expiresAt: newExpiresAt,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      Logger.error('Failed to extend App session', { error, token });
      throw error;
    }
  }

  /**
   * Get active SSO sessions for a user
   */
  async getActiveSSOSessionsForUser(userId: string): Promise<SSOSession[]> {
    try {
      const sessions = await this.prisma.sSOSession.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      return sessions;
    } catch (error) {
      Logger.error('Failed to get active SSO sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Get active App sessions for a user
   */
  async getActiveAppSessionsForUser(userId: string): Promise<AppSession[]> {
    try {
      const sessions = await this.prisma.appSession.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      return sessions;
    } catch (error) {
      Logger.error('Failed to get active App sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Cleanup expired SSO sessions
   */
  async cleanupExpiredSSOSessions(): Promise<number> {
    try {
      const result = await this.prisma.sSOSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      Logger.info('Expired SSO sessions cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      Logger.error('Failed to cleanup expired SSO sessions', { error });
      throw error;
    }
  }

  /**
   * Cleanup expired App sessions
   */
  async cleanupExpiredAppSessions(): Promise<number> {
    try {
      const result = await this.prisma.appSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      Logger.info('Expired App sessions cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      Logger.error('Failed to cleanup expired App sessions', { error });
      throw error;
    }
  }
}
