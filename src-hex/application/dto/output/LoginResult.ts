import { UserResult } from './UserResult';

/**
 * PermissionData
 * A single permission granted to a user
 */
export interface PermissionData {
  resource: string;
  action: string;
}

/**
 * TenantMembershipData
 * Tenant membership with basic tenant info
 */
export interface TenantMembershipData {
  id: string;
  name: string;
  slug?: string;
  domain?: string;
  role: string;
}

/**
 * UserContextData
 * Minimal user data for auth responses
 */
export interface UserContextData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nuid: string;
  userStatus: string;
  systemRole: string;
}

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
