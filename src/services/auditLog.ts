import { getPrismaClient } from './prisma';
import { Logger } from '../utils/logger';

export interface AuditLogEntry {
  action: string;
  userId?: string;
  jti?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditLogService {
  private static instance: AuditLogService;
  private tableAvailable: boolean | null = null;

  private constructor() {}

  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  private async ensureTable(): Promise<boolean> {
    if (this.tableAvailable !== null) return this.tableAvailable;

    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1 FROM audit_logs LIMIT 1`;
      this.tableAvailable = true;
    } catch {
      this.tableAvailable = false;
      Logger.info('audit_logs table not available - logging to console only');
    }
    return this.tableAvailable;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const canWrite = await this.ensureTable();

      if (canWrite) {
        const prisma = getPrismaClient();
        await prisma.$executeRaw`
          INSERT INTO audit_logs (id, action, user_id, jti, ip_address, user_agent, metadata, created_at)
          VALUES (gen_random_uuid(), ${entry.action}, ${entry.userId || null}::uuid, ${entry.jti || null}, ${entry.ipAddress || null}::inet, ${entry.userAgent || null}, ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb, now())
        `;
      } else {
        Logger.info('Audit log (console)', entry);
      }
    } catch (error) {
      Logger.error('Failed to write audit log', error);
    }
  }

  async logLogin(userId: string, ip?: string, userAgent?: string): Promise<void> {
    await this.log({ action: 'V2_LOGIN', userId, ipAddress: ip, userAgent });
  }

  async logLogout(userId: string, jti?: string, ip?: string, userAgent?: string): Promise<void> {
    await this.log({ action: 'V2_LOGOUT', userId, jti, ipAddress: ip, userAgent });
  }

  async logTokenRefresh(userId: string, jti?: string, ip?: string): Promise<void> {
    await this.log({ action: 'V2_TOKEN_REFRESH', userId, jti, ipAddress: ip });
  }

  async logTokenRevoke(userId: string, jti: string, ip?: string): Promise<void> {
    await this.log({ action: 'V2_TOKEN_REVOKE', userId, jti, ipAddress: ip });
  }

  async logSecurityEvent(action: string, userId: string, metadata?: Record<string, unknown>, ip?: string): Promise<void> {
    await this.log({ action, userId, ipAddress: ip, metadata });
  }
}

export const AuditLog = AuditLogService.getInstance();