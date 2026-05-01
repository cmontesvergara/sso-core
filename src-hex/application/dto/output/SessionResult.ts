/**
 * SessionResult
 * Session data returned by use cases
 */
export interface SessionResult {
  sessionId: string;
  userId: string;
  tenantId?: string;
  appId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: Date;
  createdAt: Date;
}
