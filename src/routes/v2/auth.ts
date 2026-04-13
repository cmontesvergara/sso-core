import argon2 from 'argon2';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Config } from '../../config';
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
import { findUserByEmail, findUserByNuid } from '../../repositories/userRepo.prisma';
import { AuditLog } from '../../services/auditLog';
import { AuthCodeV2 } from '../../services/authCodeV2';
import { JWT } from '../../services/jwt';
import { OTP } from '../../services/otp';
import { SessionV2, SessionV2Error } from '../../services/sessionV2';
import { RedisSessionData } from '../../types';

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

    let user;
    if (email) {
      user = await findUserByEmail(email);
    } else if (nuid) {
      user = await findUserByNuid(nuid);
    }

    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.userStatus !== 'active') {
      const encodedUserId = Buffer.from(user.id).toString('base64');
      throw new AppError(403, 'Account is not active', 'ACCOUNT_NOT_ACTIVE', [
        { userId: encodedUserId },
      ]);
    }

    const has2FA = await OTP.isOTPEnabled(user.id);
    if (has2FA) {
      const tempToken = JWT.generateTwoFactorToken(user.id);
      res.json({
        success: true,
        requiresTwoFactor: true,
        tempToken,
      });
      return;
    }

    const device = deviceInfo || {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    if (!req.body.appId) {
      console.warn('===> No appId provided in login request, using default appId from config');
    }
    if (!Config.get('sso.defaulttenantid')) {
      console.warn('===> No tenantId provided in login request, using default tenantId from config');
    }

    const appId = req.body.appId || Config.get('default_app_id');
    const tenantId = Config.get('default_tenant_id');

    const session = await SessionV2.createSsoSession(user.id, device, {
      appId,
      tenantId,
    });

    await AuditLog.logLogin(user.id, req.ip, req.get('user-agent'));

    res.json({
      success: true,
      ssoToken: session.accessToken,
      expiresIn: 15 * 60,
      user: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
      },
    });
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

      console.log('------', sessionAppId, appId);

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
        if (
          err.message === 'CODE_REUSE_DETECTED' ||
          err.message === 'INVALID_CODE_VERIFIER'
        ) {
          throw new AppError(401, err.message, 'SECURITY_VIOLATION');
        }
        throw new AppError(401, err.message || 'Invalid auth code', 'INVALID_AUTH_CODE');
      }



      const tenant = await findTenantById(codeData.tenantId);
      if (!tenant) {
        throw new AppError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
      }

      const session = await SessionV2.createAppSession(
        codeData.userId,
        { ip: req.ip, userAgent: req.get('user-agent'), },
        { appId: appId, tenantId: codeData.tenantId });

      await AuditLog.logSecurityEvent(
        'V2_EXCHANGE',
        codeData.userId,
        { tenantId: codeData.tenantId, appId },
        req.ip
      );

      let userInformation: {
        [key: string]: any;
      } = session.user;

      delete userInformation.createdAt
      delete userInformation.updatedAt
      delete userInformation.passwordHash



      const CookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
        CookieOptions.domain = process.env.COOKIE_DOMAIN;
      }

      res.cookie('v2_refresh_token', session.refreshToken, { ...CookieOptions, path: '/api/v2/auth/refresh' });
      res.cookie('bigso_app_session', session.jti, CookieOptions);
      res.cookie('bs_cookie_name_map', JSON.stringify(['refreshToken:v2_refresh_token', 'sessionId:bigso_app_session']), CookieOptions);
      res.json({
        success: true,
        tokens: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: Config.get('v2.access_token_expiry', 900),
        },
        user: userInformation,
        currentTenant: {
          ...session.tenants.find(t => t.id === codeData.tenantId),
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
      const refreshToken =
        req.cookies?.['v2_refresh_token'] || req.body?.refreshToken;

      if (!refreshToken) {
        throw new AppError(401, 'Missing refresh token', 'MISSING_REFRESH_TOKEN');
      }

      try {
        const appId = req.body?.appId;
        const newSession = await SessionV2.rotateRefreshToken(refreshToken, appId ? { appId } : undefined);

        await AuditLog.logTokenRefresh(
          newSession.jti,
          newSession.jti,
          req.ip
        );

        const refreshTokenCookieOptions: any = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/v2/auth/refresh',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        };

        if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
          refreshTokenCookieOptions.domain = process.env.COOKIE_DOMAIN;
        }

        res.cookie('v2_refresh_token', newSession.refreshToken, refreshTokenCookieOptions);

        res.json({
          success: true,
          tokens: {
            accessToken: newSession.accessToken,
            expiresIn: Config.get('v2.access_token_expiry', 900),
          },
        });
      } catch (err: any) {
        if (err instanceof SessionV2Error) {
          if (err.code === 'TOKEN_REUSE_DETECTED') {
            res.clearCookie('v2_refresh_token', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              path: '/api/v2/auth/refresh',
            });
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
      const jwt = req.headers.authorization?.substring(7) as string;
      const jwtDecoded = JWT.verifyToken(jwt) as any;
      const jti = jwtDecoded.jti as string;
      let sessionFromCache: RedisSessionData | null;
      let sessionFromPg: AppSessionWithRelations | null = null;

      sessionFromCache = await getRedisSession(jti, 'app');

      if (sessionFromCache) {
        let userInformation: {
          [key: string]: any;
        } = sessionFromCache.user;

        delete userInformation.createdAt
        delete userInformation.updatedAt
        delete userInformation.passwordHash

        res.json({
          success: true,
          user: userInformation,
          currentTenant: sessionFromCache.currentTenant,
          relatedTenants: sessionFromCache.relatedTenants,
        });
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



      console.log('Session found:', sessionFromPg);

      res.json({
        success: true,
        ...sessionFromPg
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
        const payload = SessionV2.validateAccessToken(token);
        const sessionType = payload.type === 'sso' ? 'sso' : 'app';
        await SessionV2.revokeSession(payload.jti, payload.sub, sessionType);
        await AuditLog.logTokenRevoke(payload.sub, payload.jti, req.ip);
      } catch (_) {
        // Token may be expired or invalid; continue cleanup
      }
    }

    res.clearCookie('v2_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v2/auth/refresh',
      domain: process.env.COOKIE_DOMAIN,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;