import { PrismaClient } from '@prisma/client';
import { AppSession, Session, SSOSession } from '../../domain/entities/Session';

/**
 * SessionEnrichmentService
 *
 * Enriches AppSession entities with data from the Application table.
 * This centralizes the logic for adding audience, url, and backendUrl
 * to sessions that may have been loaded from the database without these fields.
 * For SSOSession, returns the session unchanged.
 */
export class SessionEnrichmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enrich a Session (AppSession or SSOSession) with Application data
   * Only enriches AppSession; SSOSession is returned unchanged
   * Only performs a database lookup if the AppSession doesn't already have audience data
   */
  async enrich(session: Session): Promise<Session> {
    // Only enrich AppSession instances
    if (!(session instanceof AppSession)) {
      return session;
    }

    // Only enrich if the session doesn't already have audience data
    // This avoids unnecessary database lookups
    if (session.audience) {
      return session;
    }

    const appRecord = await this.prisma.application.findUnique({
      where: { appId: session.appId },
      select: { audience: true, url: true, backendUrl: true },
    });

    if (!appRecord) {
      // Cannot enrich, return original session
      return session;
    }

    return new AppSession(
      session.id,
      session.sessionToken,
      session.userId,
      session.tenantId,
      session.appId,
      session.role,
      session.ip,
      session.userAgent,
      session.expiresAt,
      session.createdAt,
      session.lastActivityAt,
      session.ssoSessionId,
      appRecord.audience ?? undefined,
      appRecord.url ?? undefined,
      appRecord.backendUrl ?? undefined
    );
  }
}
