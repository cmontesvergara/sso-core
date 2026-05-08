import { LoginInput } from '../../dto/input/LoginInput';
import { LoginResult } from '../../dto/output/LoginResult';
import { LogoutInput } from '../../dto/input/LogoutInput';
import { RefreshTokenInput } from '../../dto/input/RefreshTokenInput';
import { TokenResult } from '../../dto/output/TokenResult';
import { ExchangeCodeInput } from '../../dto/input/ExchangeCodeInput';

/**
 * IAuthPort
 * Interface exposing authentication capabilities to the outside world
 * Primary port (input) - implemented by controllers/adapters
 */
export interface IAuthPort {
  /**
   * Authenticate user with credentials
   */
  login(input: LoginInput): Promise<LoginResult>;

  /**
   * End user session
   */
  logout(input: LogoutInput): Promise<void>;

  /**
   * Refresh access token using refresh token
   */
  refreshToken(input: RefreshTokenInput): Promise<TokenResult>;

  /**
   * Exchange authorization code for tokens (PKCE)
   */
  exchangeCode(input: ExchangeCodeInput): Promise<TokenResult>;
}
