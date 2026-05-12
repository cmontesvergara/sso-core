/**
 * RefreshTokenInput
 * Data required for token refresh
 */
export interface RefreshTokenInput {
  refreshToken: string;
  appId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
}
