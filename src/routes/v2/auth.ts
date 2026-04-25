import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Config } from '../../config';
import { COOKIE_NAMES, getRefreshTokenCookieOptions } from '../../constants/cookies';
import { getContainer } from '../../core/container-config';
import { UserMapperStatic } from '../../core/mappers/user.mapper';
import { UserRepository } from '../../core/repositories/user.repository';
import {
  authorizeV2Schema,
  exchangeV2Schema,
  loginV2Schema,
} from '../../core/schemas/auth-v2.schema';
import { AppError } from '../../middleware/errorHandler';
import { authenticateV2AccessToken } from '../../middleware/v2Auth';
import { findApplicationByAppId } from '../../repositories/applicationRepo.prisma';
import { AppSessionWithRelations, findAppSessionByToken } from '../../repositories/appSessionRepo.prisma';
import { getRedisSession } from '../../repositories/redisSessionRepo';
import { findTenantApp } from '../../repositories/tenantAppRepo.prisma';
import { findTenantById, findTenantMember } from '../../repositories/tenantRepo.prisma';
import { userHasAppAccess } from '../../repositories/userAppAccessRepo.prisma';
import { AuditLog } from '../../services/auditLog';
import { AuthCodeV2 } from '../../services/authCodeV2';
import { AuthServiceV2 } from '../../services/authV2';
import { JWT } from '../../services/jwt';
import { AppSessionService } from '../../services/session/app-session.service';
import { RefreshTokenService, RefreshTokenValidationError } from '../../services/session/refresh-token.service';
import { SessionRevokerService } from '../../services/session/session-revoker.service';
import { RedisSessionData } from '../../types';
import { Logger } from '../../utils/logger';

// Service instances from container
const container = getContainer();
const authService = () => container.get<AuthServiceV2>('AuthServiceV2');
const appSessionService = () => container.get<AppSessionService>('AppSessionService');
const refreshTokenService = () => container.get<RefreshTokenService>('RefreshTokenService');
const sessionRevokerService = () => container.get<SessionRevokerService>('SessionRevokerService');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: Config.get('rateLimit.signin.windowMs', 15 * 60 * 1000),
  max: Config.get('rateLimit.signin.max', 10),
  standardHeaders: true,
  legacyHeaders: false,
});
const exchangeLimiter = rateLimit({
  windowMs: Config.get('rateLimit.refresh.windowMs', 5 * 60 * 1000),
  max: Config.get('rateLimit.refresh.max', 30),
  standardHeaders: true,
  legacyHeaders: false,
});
const refreshLimiter = rateLimit({
  windowMs: Config.get('rateLimit.refresh.windowMs', 15 * 60 * 1000),
  max: Config.get('rateLimit.refresh.max', 20),
  standardHeaders: true,
  legacyHeaders: false,
});
const sessionLimiter = rateLimit({
  windowMs: Config.get('rateLimit.session.windowMs', 15 * 60 * 1000),
  max: Config.get('rateLimit.session.max', 30),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginV2Schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    const { email, nuid, password, deviceInfo } = value;

    const result = await authService().login({
      email,
      nuid,
      password,
      appId: req?.body?.appId || Config.get('default_app_id'),
      tenantId: Config.get('default_tenant_id'),
      ip: deviceInfo?.ip || req.ip,
      userAgent: deviceInfo?.userAgent || req.get('user-agent'),
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/authorize',
  authenticateV2AccessToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = authorizeV2Schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        const details = error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        }));
        throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
      }

      const { tenantId, appId, redirectUri, codeChallenge, codeChallengeMethod, codeVerifier, state, nonce } =
        value;
      const userId = req.v2User!.userId;
      const sessionAppId = req.v2User!.appId;


      if (sessionAppId !== appId) {
        throw new AppError(403, 'App mismatch. Cannot authorize for a different app than the login session', 'APP_MISMATCH');
      }

      const tenantMember = await findTenantMember(tenantId, userId);
      if (!tenantMember) {
        throw new AppError(403, 'Access denied to tenant', 'TENANT_ACCESS_DENIED');
      }

      const application = await findApplicationByAppId(appId);
      if (!application || !application.isActive) {
        throw new AppError(404, 'Application not found or inactive', 'APP_NOT_FOUND');
      }

      const tenantApp = await findTenantApp(tenantId, application.id);
      if (!tenantApp || !tenantApp.isEnabled) {
        throw new AppError(403, 'Application not enabled for this tenant', 'APP_NOT_ENABLED_FOR_TENANT');
      }

      const hasAccess = await userHasAppAccess(userId, tenantId, application.id);
      if (!hasAccess) {
        throw new AppError(403, 'Access denied to application', 'APP_ACCESS_DENIED');
      }

      const { code, expiresIn } = await AuthCodeV2.generateCode(
        userId,
        tenantId,
        appId,
        codeChallenge,
        codeChallengeMethod
      );

      await AuditLog.logSecurityEvent(
        'V2_AUTHORIZE',
        userId,
        { tenantId, appId, code: code.substring(0, 10) + '...' },
        req.ip
      );

      const response: Record<string, any> = {
        success: true,
        code,
        expiresIn,
        redirectUri: `${redirectUri}?code=${code}`,
      };

      if (state) {
        response.state = state;
      }

      if (codeChallenge) {
        const audience = application.audience || application.url || redirectUri;
        const jwsPayload: Record<string, any> = {
          code,
          state: state || undefined,
          nonce: nonce || undefined,
          appId,
          tenantId,
        };

        if (codeVerifier) {
          jwsPayload.code_verifier = codeVerifier;
        }

        if (application.scope && application.scope.length > 0) {
          jwsPayload.scope = application.scope;
        }

        const signedPayload = JWT.generateToken(
          jwsPayload,
          5 * 60,
          audience
        );
        response.signedPayload = signedPayload;
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/exchange',
  exchangeLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = exchangeV2Schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        const details = error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        }));
        throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
      }

      const { code, appId, codeVerifier } = value;

      let codeData;
      try {
        codeData = await AuthCodeV2.exchangeCode(code, appId, codeVerifier);
      } catch (err: any) {
        console.error('Error during auth code exchange:', err);
        if (
          err.message === 'CODE_REUSE_DETECTED' ||
          err.message === 'INVALID_CODE_VERIFIER'
        ) {
          throw new AppError(401, err.message, 'SECURITY_VIOLATION');
        }
        throw new AppError(401, err.message || 'Invalid auth code_', 'INVALID_AUTH_CODE_');
      }


      const tenant = await findTenantById(codeData.tenantId);
      if (!tenant) {
        throw new AppError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
      }

      const userRepo = container.get<UserRepository>('UserRepository');
      const user = await userRepo.findUserById(codeData.userId);
      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }
      const session = await appSessionService().createSession(
        codeData.userId,
        user,
        { ip: req.ip, userAgent: req.get('user-agent'), },
        { appId: appId, tenantId: codeData.tenantId });

      await AuditLog.logSecurityEvent(
        'V2_EXCHANGE',
        codeData.userId,
        { tenantId: codeData.tenantId, appId },
        req.ip
      );

      const userInformation = UserMapperStatic.toSafeObject(session.user as any);

      //const cookieOptions = getRefreshTokenCookieOptions();

      // res.cookie(COOKIE_NAMES.REFRESH_TOKEN, session.refreshToken, cookieOptions);
      // res.cookie(COOKIE_NAMES.APP_SESSION, session.jti, {
      //   ...cookieOptions,
      //   path: COOKIE_PATHS.APP_SESSION,
      //   sameSite: 'lax' as const,
      // });
      // res.cookie(COOKIE_NAMES.COOKIE_MAP, JSON.stringify(COOKIE_MAP_VALUE), cookieOptions);
      res.json({
        success: true,
        tokens: {
          jti: session.jti,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: Config.get('v2.access_token_expiry', 900),
        },
        user: userInformation,
        currentTenant: {
          ...session.tenants.find((t: any) => t.id === codeData.tenantId),
          permissions: session.permissions
        },
        relatedTenants: session.tenants,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/refresh',
  refreshLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken;

      if (!refreshToken) {
        throw new AppError(401, 'Missing refresh token', 'MISSING_REFRESH_TOKEN');
      }

      try {
        const appId = req.body?.appId;
        const tenantId =
          req.headers['x-tenant-id']?.toString() ||
          req.body?.tenantId;

        if (!tenantId) {
          throw new AppError(400, 'Missing tenantId', 'MISSING_TENANT_ID');
        }
        const newSession = await refreshTokenService().rotateToken(refreshToken, { appId, tenantId });

        await AuditLog.logTokenRefresh(
          newSession.jti,
          newSession.jti,
          req.ip
        );

        const cookieOptions = getRefreshTokenCookieOptions();

        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, newSession.refreshToken, cookieOptions);

        res.json({
          success: true,
          tokens: {
            accessToken: newSession.accessToken,
            expiresIn: Config.get('v2.access_token_expiry', 900),
          },
        });
      } catch (err: any) {
        if (err instanceof RefreshTokenValidationError) {
          if (err.code === 'TOKEN_REUSE_DETECTED') {
            res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, getRefreshTokenCookieOptions());
            throw new AppError(401, err.message, 'SECURITY_VIOLATION');
          }
          throw new AppError(401, err.message, err.code);
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  }
);




router.post(
  '/session',
  sessionLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      const jti = req.body.sessionId;
      let sessionFromCache: RedisSessionData | null;
      let sessionFromPg: AppSessionWithRelations | null = null;

      sessionFromCache = await getRedisSession(jti, 'app');
      console.log('sessionFromCache', sessionFromCache)
      if (sessionFromCache) {
        const userInformation = UserMapperStatic.toSafeObject(sessionFromCache.user as any);

        res.json({
          success: true,
          tokens: {//TODO: en ves de guardar para enviarlo en el session, usar el refresh token y renovarlo
            accessToken: sessionFromCache.tokens.accessToken
          },
          user: userInformation,
          currentTenant: sessionFromCache.currentTenant,
          relatedTenants: sessionFromCache.relatedTenants,
        });
        return;
      }

      if (!sessionFromCache) {
        sessionFromPg = await findAppSessionByToken(jti) as AppSessionWithRelations;
      }

      if (!sessionFromPg) {
        res.json({
          success: true,
          valid: false,
          message: 'Session not found',
        });
        return;
      }

      Logger.debug('Session found', { jti, userId: sessionFromPg.user.id });

      const userInformation = UserMapperStatic.toSafeObject(sessionFromPg.user as any);

      res.json({
        success: true,
        user: userInformation,
        currentTenant: sessionFromPg.tenant,
        relatedTenants: [sessionFromPg.tenant],
      });
    } catch (error) {
      next(error);
    }
  }
);



router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = JWT.verifyToken(token) as any;
        const sessionType = payload.type === 'sso' ? 'sso' : 'app';
        if (sessionType === 'sso') {
          await sessionRevokerService().revokeSsoSession(payload.jti, payload.sub);
        } else {
          await sessionRevokerService().revokeAppSession(payload.jti, payload.sub);
        }
        await AuditLog.logTokenRevoke(payload.sub, payload.jti, req.ip);
      } catch (_) {
        // Token may be expired or invalid; continue cleanup
      }
    }

    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
      ...getRefreshTokenCookieOptions(),
      domain: process.env.COOKIE_DOMAIN,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;