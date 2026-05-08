import { SSOSession, AppSession } from '../../../domain/entities/Session';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaSessionRepository
 * Implementation of ISessionRepository using Prisma ORM
 * Aligned with Prisma schema (SSOSession and AppSession tables)
 */
export class PrismaSessionRepository implements ISessionRepository {
  constructor(private prisma: PrismaClient) { }

  async findById(id: SessionId): Promise<SSOSession | AppSession | null> {
    // Try SSO session first
    const ssoSession = await this.prisma.sSOSession.findUnique({
      where: { sessionToken: id.value },
    });

    if (ssoSession) {
      return this.mapSSOSessionToDomain(ssoSession);
    }

    // Try App session
    const appSession = await this.prisma.appSession.findUnique({
      where: { sessionToken: id.value },
    });

    if (appSession) {
      return this.mapAppSessionToDomain(appSession);
    }

    return null;
  }

  async findByUser(userId: UserId): Promise<(SSOSession | AppSession)[]> {
    const [ssoSessions, appSessions] = await Promise.all([
      this.prisma.sSOSession.findMany({
        where: { userId: userId.value },
      }),
      this.prisma.appSession.findMany({
        where: { userId: userId.value },
      }),
    ]);

    return [
      ...ssoSessions.map(this.mapSSOSessionToDomain),
      ...appSessions.map(this.mapAppSessionToDomain),
    ];
  }

  async findActiveByUser(userId: UserId): Promise<(SSOSession | AppSession)[]> {
    const now = new Date();
    const [ssoSessions, appSessions] = await Promise.all([
      this.prisma.sSOSession.findMany({
        where: {
          userId: userId.value,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.appSession.findMany({
        where: {
          userId: userId.value,
          expiresAt: { gt: now },
        },
      }),
    ]);

    return [
      ...ssoSessions.map(this.mapSSOSessionToDomain),
      ...appSessions.map(this.mapAppSessionToDomain),
    ];
  }

  async save(session: SSOSession | AppSession): Promise<void> {
    if (session instanceof SSOSession) {
      await this.prisma.sSOSession.create({
        data: {
          //id: session.id.value,
          sessionToken: session.sessionToken,
          userId: session.userId.value,
          ip: session.ip,
          userAgent: session.userAgent,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
        },
      });
    } else {
      // AppSession
      await this.prisma.appSession.create({
        data: {
          // id: session.id.value,
          sessionToken: session.sessionToken,
          userId: session.userId.value,
          tenantId: (session as AppSession).tenantId.value,
          appId: (session as AppSession).appId,
          role: (session as AppSession).role,
          ip: session.ip,
          userAgent: session.userAgent,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          ssoSessionId: (session as AppSession).ssoSessionId || null,
        },
      });
    }
  }

  async update(session: SSOSession | AppSession): Promise<void> {
    if (session instanceof SSOSession) {
      await this.prisma.sSOSession.update({
        where: { sessionToken: session.sessionToken },
        data: {
          expiresAt: session.expiresAt,
          lastActivityAt: session.lastActivityAt,
        },
      });
    } else {
      await this.prisma.appSession.update({
        where: { sessionToken: session.sessionToken },
        data: {
          expiresAt: session.expiresAt,
          lastActivityAt: session.lastActivityAt,
        },
      });
    }
  }

  async delete(id: SessionId): Promise<void> {
    await Promise.all([
      this.prisma.sSOSession.deleteMany({
        where: { sessionToken: id.value },
      }),
      this.prisma.appSession.deleteMany({
        where: { sessionToken: id.value },
      }),
    ]);
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    const [ssoResult, appResult] = await Promise.all([
      this.prisma.sSOSession.deleteMany({
        where: { userId: userId.value },
      }),
      this.prisma.appSession.deleteMany({
        where: { userId: userId.value },
      }),
    ]);

    return ssoResult.count + appResult.count;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const [ssoResult, appResult] = await Promise.all([
      this.prisma.sSOSession.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      this.prisma.appSession.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    ]);

    return ssoResult.count + appResult.count;
  }

  async countActive(): Promise<number> {
    const now = new Date();
    const [ssoCount, appCount] = await Promise.all([
      this.prisma.sSOSession.count({
        where: { expiresAt: { gt: now } },
      }),
      this.prisma.appSession.count({
        where: { expiresAt: { gt: now } },
      }),
    ]);

    return ssoCount + appCount;
  }

  private mapSSOSessionToDomain(prismaSession: any): SSOSession {
    return new SSOSession(
      SessionId.create(prismaSession.sessionToken),
      prismaSession.sessionToken,
      UserId.create(prismaSession.userId),
      prismaSession.ip,
      prismaSession.userAgent,
      prismaSession.expiresAt,
      prismaSession.createdAt,
      prismaSession.lastActivityAt
    );
  }

  private mapAppSessionToDomain(prismaSession: any): AppSession {
    return new AppSession(
      SessionId.create(prismaSession.sessionToken),
      prismaSession.sessionToken,
      UserId.create(prismaSession.userId),
      TenantId.create(prismaSession.tenantId),
      prismaSession.appId,
      prismaSession.role,
      prismaSession.ip,
      prismaSession.userAgent,
      prismaSession.expiresAt,
      prismaSession.createdAt,
      prismaSession.lastActivityAt,
      prismaSession.ssoSessionId
    );
  }
}
