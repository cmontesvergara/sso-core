import { Request, Response, NextFunction } from 'express';
import { LoginUseCase } from '../../../application/use-cases/auth/LoginUseCase';
import { LogoutUseCase } from '../../../application/use-cases/auth/LogoutUseCase';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/RefreshTokenUseCase';
import { ExchangeCodeUseCase } from '../../../application/use-cases/auth/ExchangeCodeUseCase';
import { AuthorizeUseCase } from '../../../application/use-cases/auth/AuthorizeUseCase';
import { GetSessionContextUseCase } from '../../../application/use-cases/auth/GetSessionContextUseCase';
import { SessionId } from '../../../domain/value-objects/SessionId';
import { LoginInput } from '../../../application/dto/input/LoginInput';
import { DeviceFingerprint } from '../../../domain/value-objects/DeviceFingerprint';

/**
 * AuthController
 * HTTP adapter for auth use cases.
 * Maps HTTP requests to use case inputs and use case results to HTTP responses.
 */
export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private logoutUseCase: LogoutUseCase,
    private refreshTokenUseCase: RefreshTokenUseCase,
    private exchangeCodeUseCase: ExchangeCodeUseCase,
    private authorizeUseCase: AuthorizeUseCase,
    private getSessionContextUseCase: GetSessionContextUseCase
  ) { }

  /**
   * POST /api/v3/auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input: LoginInput = {
        email: req.body.email,
        nuid: req.body.nuid,
        password: req.body.password,
        appId: req.body.appId,
        tenantId: req.body.tenantId,
        deviceFingerprint: DeviceFingerprint.create({
          ip: req.ip ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }),
      };
      const result = await this.loginUseCase.execute(input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/auth/logout
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.logoutUseCase.execute({
        sessionId: SessionId.create(req.body.sessionId),
        userId: (req as any).userId,
        isGlobal: req.body.isGlobal ?? false,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/auth/refresh
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.refreshTokenUseCase.execute({
        refreshToken: req.body.refreshToken,
        tenantId: req.body.tenantId,
        appId: req.body.appId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/auth/exchange
   */
  exchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.exchangeCodeUseCase.execute({
        code: req.body.code,
        codeVerifier: req.body.codeVerifier,
        appId: req.body.appId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
  /**
   * POST /api/v3/auth/authorize
   * OAuth2 Authorization Code step.
   * Requires a valid SSO Bearer token.
   * Body: { tenantId, appId, redirectUri, codeChallenge?, codeChallengeMethod?, state?, nonce? }
   */
  authorize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // sessionId is injected by AuthMiddleware from the validated token
      const sessionId = (req as any).sessionId ?? (req as any).userId;

      const result = await this.authorizeUseCase.execute({
        sessionId,
        tenantId: req.body.tenantId,
        appId: req.body.appId,
        redirectUri: req.body.redirectUri,
        codeChallenge: req.body.codeChallenge,
        codeChallengeMethod: req.body.codeChallengeMethod,
        state: req.body.state,
        nonce: req.body.nonce,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/auth/session
   */
  session = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getSessionContextUseCase.execute({
        sessionId: req.body.sessionId,
        appId: req.body.appId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
