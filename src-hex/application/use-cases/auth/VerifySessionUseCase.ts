import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { SessionExpiredError } from '../../../domain/errors/SessionExpiredError';
import { SessionNotFoundError } from '../../../domain/errors/SessionNotFoundError';
import { TokenClaims } from '../../ports/output/ITokenService';

export interface VerifySessionInput {
  accessToken: string;
}

export interface VerifySessionResult {
  valid: boolean;
  userId: string;
  sessionId: string;
  claims: TokenClaims;
}

/**
 * VerifySessionUseCase
 * Validates a Bearer access token and confirms the associated session is active.
 * Used by AuthMiddleware on every authenticated request.
 */
export class VerifySessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService
  ) {}

  async execute(input: VerifySessionInput): Promise<VerifySessionResult> {
    // 1. Validate JWT signature and expiry
    const claims = await this.tokenService.validateAccessToken(input.accessToken);

    // 2. Lookup session in DB using the jti (session token)
    const sessionId = SessionId.create(claims.jti);
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(claims.jti);
    }

    // 3. Check session has not expired
    if (session.expiresAt < new Date()) {
      await this.auditService.log({
        type: 'SESSION_EXPIRED',
        userId: claims.sub,
        sessionId: claims.jti,
      });
      throw new SessionExpiredError(claims.jti);
    }

    return {
      valid: true,
      userId: claims.sub,
      sessionId: claims.jti,
      claims,
    };
  }
}
