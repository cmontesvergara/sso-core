import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

/**
 * AuditLogCleanupJob
 *
 * Scheduled cron job that deletes audit_log records older than
 * AUDIT_LOG_RETENTION_DAYS (default: 30) every day at 3:00 AM UTC.
 *
 * Configure via environment variable:
 *   AUDIT_LOG_RETENTION_DAYS=30
 */
export class AuditLogCleanupJob {
  private readonly retentionDays: number;

  constructor(private readonly prisma: PrismaClient) {
    this.retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '30', 10);
  }

  start(): void {
    // Runs every day at 3:00 AM UTC
    cron.schedule('0 3 * * *', () => this.runCleanup(), { timezone: 'UTC' });

    console.log(
      `[AuditLogCleanupJob] Scheduled — retention: ${this.retentionDays} days, runs daily at 03:00 UTC`
    );
  }

  async runCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      console.log(
        `[AuditLogCleanupJob] Deleted ${result.count} audit log(s) older than ${cutoff.toISOString()}`
      );
    } catch (err) {
      console.error('[AuditLogCleanupJob] Cleanup failed:', err);
    }
  }
}
