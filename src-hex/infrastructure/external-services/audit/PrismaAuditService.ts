import { IAuditService, AuditEvent } from '../../../application/ports/output/IAuditService';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaAuditService
 * Implementation of IAuditService that persists audit events to the database.
 * Falls back to console.warn on write failure so the main flow is never blocked.
 */
export class PrismaAuditService implements IAuditService {
  constructor(private prisma: PrismaClient) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.type,
          userId: event.userId ?? null,
          ipAddress: event.ip ?? null,
          userAgent: event.userAgent ?? null,
          metadata: event.metadata ?? undefined,
          createdAt: new Date(),
        },
      });
    } catch (err) {
      console.warn('[AuditService] Failed to persist audit log:', err);
    }
  }

  async logSecurity(event: AuditEvent): Promise<void> {
    await this.log({ ...event, type: `SECURITY_${event.type}` });
  }

  async logAuthSuccess(userId: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      type: 'AUTH_SUCCESS',
      userId,
      ip,
      userAgent,
    });
  }

  async logAuthFailure(email: string, ip: string, reason: string): Promise<void> {
    await this.log({
      type: 'AUTH_FAILURE',
      ip,
      metadata: { email, reason },
    });
  }
}
