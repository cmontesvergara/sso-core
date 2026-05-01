/**
 * AuditEvent
 * Event data for auditing
 */
export interface AuditEvent {
  type: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * IAuditService
 * Port for audit logging
 * Implemented in infrastructure layer
 */
export interface IAuditService {
  /**
   * Log an audit event
   */
  log(event: AuditEvent): Promise<void>;

  /**
   * Log a security event
   */
  logSecurity(event: AuditEvent): Promise<void>;

  /**
   * Log authentication success
   */
  logAuthSuccess(userId: string, ip: string, userAgent: string): Promise<void>;

  /**
   * Log authentication failure
   */
  logAuthFailure(email: string, ip: string, reason: string): Promise<void>;
}
