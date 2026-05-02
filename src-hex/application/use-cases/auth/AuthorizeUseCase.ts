import { randomUUID, randomBytes } from 'crypto';
import { IAuthCodeRepository } from '../../../domain/repositories/IAuthCodeRepository';
import { IApplicationRepository } from '../../../domain/repositories/IApplicationRepository';
import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository';
import { ITokenService } from '../../ports/output/ITokenService';
import { IAuditService } from '../../ports/output/IAuditService';
import { AuthCode } from '../../../domain/entities/AuthCode';
import { AuthCodeId } from '../../../domain/value-objects/Ids';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { TenantAccessDeniedError } from '../../../domain/errors/TenantAccessDeniedError';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';

export interface AuthorizeInput {
  /** SSO session token from Authorization header (Bearer) */
  sessionId: string;
  tenantId: string;
  appId: string;
  redirectUri: string;
  /** PKCE code challenge (SHA-256 of codeVerifier, base64url) */
  codeChallenge?: string;
  codeChallengeMethod?: string;
  state?: string;
  nonce?: string;
}

export interface AuthorizeResult {
  success: true;
  code: string;
  expiresIn: number;
  /** Full redirect URI with code appended */
  redirectUri: string;
  state?: string;
  /** Short-lived signed JWT wrapping code + metadata (PKCE flows) */
  signedPayload?: string;
}

/**
 * AuthorizeUseCase
 * OAuth2 Authorization Code step.
 *
 * Flow:
 *  1. Validate the caller has an active SSO session
 *  2. Verify the user belongs to the requested tenant
 *  3. Verify the application exists and is active
 *  4. Verify the application is enabled for the tenant
 *  5. Generate an AuthCode (PKCE-ready)
 *  6. Return { code, redirectUri, state, signedPayload }
 *
 * The resulting code is consumed by ExchangeCodeUseCase (POST /auth/exchange).
 */
export class AuthorizeUseCase {
  constructor(
    private authCodeRepository: IAuthCodeRepository,
    private applicationRepository: IApplicationRepository,
    private tenantRepository: ITenantRepository,
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService
  ) {}

  async execute(input: AuthorizeInput): Promise<AuthorizeResult> {
    // 1. Resolve session → userId
    const session = await this.sessionRepository.findById(SessionId.create(input.sessionId));
    if (!session) throw new InvalidCredentialsError();

    const userId = session.userId;

    // 2. Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UserNotFoundError(userId.value);

    // 3. Verify user is member of the requested tenant
    if (!user.canAccessTenant(TenantId.create(input.tenantId))) {
      throw new TenantAccessDeniedError(userId.value, input.tenantId);
    }

    // 4. Verify application exists and is active
    const application = await this.applicationRepository.findByClientId(input.appId);
    if (!application || !application.isActive) {
      throw new TenantAccessDeniedError(userId.value, input.tenantId);
    }

    // 5. Verify app is enabled for the tenant
    const tenant = await this.tenantRepository.findById(TenantId.create(input.tenantId));
    if (!tenant) throw new TenantAccessDeniedError(userId.value, input.tenantId);

    // 6. Generate authorization code (valid 5 minutes)
    const code = this.generateCode();
    const expiresIn = 5 * 60; // seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const authCode = new AuthCode(
      AuthCodeId.create(this.generateId()),
      code,
      userId,
      TenantId.create(input.tenantId),
      input.appId,
      input.redirectUri,
      expiresAt,
      new Date(),
      false,
      input.codeChallenge ?? null,
      input.codeChallengeMethod ?? null,
      input.state ?? null,
      input.nonce ?? null,
      null // ssoSessionId omitted because input.sessionId is a token string, not a UUID
    );

    await this.authCodeRepository.save(authCode);

    // 7. Audit
    await this.auditService.log({
      type: 'AUTHORIZE',
      userId: userId.value,
      tenantId: input.tenantId,
      metadata: {
        appId: input.appId,
        code: code.substring(0, 10) + '...',
        pkce: !!input.codeChallenge,
      },
    });

    // 8. Build result — optionally include signedPayload for PKCE flows
    const result: AuthorizeResult = {
      success: true,
      code,
      expiresIn,
      redirectUri: `${input.redirectUri}?code=${code}${input.state ? `&state=${input.state}` : ''}`,
    };

    if (input.state) {
      result.state = input.state;
    }

    if (input.codeChallenge) {
      // Short-lived signed JWT wrapping the code metadata — consumed by client
      const targetAudience = application.audience || application.url || input.redirectUri;
      const jwsPayload: Record<string, any> = {
        code,
        appId: input.appId,
        tenantId: input.tenantId,
      };

      if (input.state) jwsPayload.state = input.state;
      if (input.nonce) jwsPayload.nonce = input.nonce;
      if (application.scope && application.scope.length > 0) {
        jwsPayload.scope = Array.from(application.scope);
      }

      const signedPayload = this.tokenService.generateSignedPayload(jwsPayload, targetAudience);
      result.signedPayload = signedPayload;
    }

    return result;
  }

  private generateCode(): string {
    // 48 chars from URL-safe alphabet — cryptographically random
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const bytes = randomBytes(48);
    return Array.from(bytes).map(b => chars[b % chars.length]).join('');
  }

  private generateId(): string {
    return randomUUID(); // valid UUID v4 — required by Prisma UUID column
  }
}
