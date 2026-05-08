import { UserResult } from './UserResult';

/**
 * LoginResult
 * Result of successful authentication
 */
export interface LoginResult {
  success: boolean;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  
  // Legacy SSO flat tokens (for fallback/compatibility if needed)
  accessToken?: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: 'Bearer';

  // Strict V2/Hexagonal structure required by ordamy-middleware
  tokens?: {
    jti: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user?: UserResult | any;
  currentTenant?: any;
  relatedTenants?: any[];
}
