import { IAuthCodeRepository } from '../../../domain/repositories/IAuthCodeRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { AppSession } from '../../../domain/entities/Session';
import { LoginResult } from '../../dto/output/LoginResult';
import { InvalidAuthCodeError } from '../../../domain/errors/InvalidAuthCodeError';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';

export interface ExchangeCodeInput {
  code: string;
  codeVerifier?: string;
  redirectUri: string;
  appId: string;
}

/**
 * ExchangeCodeUseCase
 * Exchanges a PKCE authorization code for access + refresh tokens.
 * Implements the OAuth 2.0 Authorization Code flow (PKCE).
 */
export class ExchangeCodeUseCase {
  constructor(
    private authCodeRepository: IAuthCodeRepository,
    private sessionRepository: ISessionRepository,
    private userRepository: IUserRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private _eventBus: IEventBus
  ) {}

  async execute(input: ExchangeCodeInput): Promise<LoginResult> {
    // 1. Find auth code
    const authCode = await this.authCodeRepository.findByCode(input.code);
    if (!authCode) {
      throw new InvalidAuthCodeError('Auth code not found');
    }

    // 2. Validate code is usable
    if (!authCode.isUsable()) {
      throw new InvalidAuthCodeError('Auth code has expired or already been used');
    }

    // 3. Validate redirect URI matches
    if (authCode.redirectUri !== input.redirectUri) {
      throw new InvalidAuthCodeError('Redirect URI mismatch');
    }

    // 4. Verify PKCE verifier
    if (input.codeVerifier !== undefined && !authCode.verifyVerifier(input.codeVerifier)) {
      throw new InvalidAuthCodeError('PKCE code verifier does not match');
    }

    // 5. Confirm user exists
    const user = await this.userRepository.findById(authCode.userId);
    if (!user) {
      throw new UserNotFoundError(authCode.userId.value);
    }

    // 6. Mark code as used
    const usedCode = authCode.markAsUsed();
    await this.authCodeRepository.update(usedCode);

    // 7. Create app session
    const sessionToken = `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min

    const session = new AppSession(
      SessionId.create(sessionToken),
      sessionToken,
      authCode.userId,
      authCode.tenantId,
      input.appId,
      'user',
      null,
      null,
      expiresAt,
      now,
      now,
      authCode.ssoSessionId ?? undefined
    );
    await this.sessionRepository.save(session);

    // 8. Generate tokens
    const tokens = await this.tokenService.generateTokens(session);

    // 9. Audit
    await this.auditService.log({
      type: 'CODE_EXCHANGED',
      userId: authCode.userId.value,
      sessionId: sessionToken,
      metadata: { appId: input.appId },
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }
}
