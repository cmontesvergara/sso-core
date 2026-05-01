import { UserResult } from './UserResult';

/**
 * TokenResult
 * Result of token operations
 */
export interface TokenResult {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user?: UserResult;
}
