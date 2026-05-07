import { PrismaClient } from '@prisma/client';
import { AppSession } from '../../domain/entities/Session';

/**
 * SessionEnrichmentService
 *
 * Enriches AppSession entities with data from the Application table.
 * This centralizes the logic for adding audience, url, and backendUrl
 * to sessions that may have been loaded from the database without these fields.
 */
export class SessionEnrichmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enrich an AppSession with Application data (audience, url, backendUrl)
   * Only performs a database lookup if the session doesn't already have audience data
   */
  async enrich(session: AppSession): Promise<AppSession> {
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
