import { UserResult } from './UserResult';

/**
 * LoginResult
 * Result of successful authentication
 */
export interface LoginResult {
  success: boolean;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn: number;
  user?: UserResult;
  tokenType?: 'Bearer';
}
