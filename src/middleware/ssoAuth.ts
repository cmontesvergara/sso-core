import { NextFunction, Request, Response } from 'express';
import { SSOSession } from '../services/ssoSession';
import { AppError } from './errorHandler';
import { findAppSessionByToken } from '../repositories/appSessionRepo.prisma';
import { getActiveSSOSessionsForUser } from '../repositories/ssoSessionRepo.prisma';
import { getAppSessionTokenFromCookies } from '../utils/cookieUtils';
import { Config } from '../config';
import { SessionV2 } from '../services/sessionV2';

/**
 * Extend Express Request to include SSO user context
 */
declare global {
  namespace Express {
    interface Request {
      ssoUser?: {
        sessionId: string;
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
        userStatus: string;
        systemRole: string;
      };
    }
  }
}

/**
 * Try to auto-login SSO from an active app_session cookie.
 * If the app session is valid, creates a new SSO session and sets the cookie.
 *
 * @returns The new SSO session token, or null if auto-login was not possible.
 */
async function tryAutoLoginFromAppSession(
  req: Request,
  res: Response
): Promise<string | null> {
  const appSessionToken = getAppSessionTokenFromCookies(req);
  
  if (!appSessionToken) return null;

  // CSRF Mitigation: Since bigapp-session cookies are cross-domain (.bigso.co),
  // we must ensure the auto-login request actually comes from a trusted origin.
  // This prevents attackers from forging cross-domain requests.
  const referer = req.get('referer') || req.get('origin');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const isTrustedDomain =
        refererUrl.hostname.endsWith('.bigso.co') ||
        refererUrl.hostname === 'localhost' ||
        refererUrl.hostname === '127.0.0.1';

      if (!isTrustedDomain) {
        return null; // Reject auto-login if referer is untrusted
      }
    } catch (_) {
      // Invalid URL format in referer
      return null;
    }
  }

  const appSession = await findAppSessionByToken(appSessionToken);
  if (!appSession || appSession.expiresAt <= new Date()) return null;

  // Race Condition Fix: If the frontend sends multiple concurrent requests without the sso_session cookie,
  // we must avoid creating multiple new sessions. We reuse the most recent active session for this user.
  const activeSessions = await getActiveSSOSessionsForUser(appSession.userId);
  let ssoSession;

  if (activeSessions.length > 0) {
    // Reuse existing latest active session to avoid race condition duplicates
    const existing = activeSessions[0];
    const ttl = Config.get('sso_session_ttl', 24 * 60 * 60);

    ssoSession = {
      sessionToken: existing.sessionToken,
      maxAge: ttl * 1000,
    };
  } else {
    // No active sessions, create a new one
    ssoSession = await SSOSession.createSession(appSession.userId, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ssoSession.maxAge,
  };

  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.cookie('sso_session', ssoSession.sessionToken, cookieOptions);
  return ssoSession.sessionToken;
}

/**
 * Middleware to authenticate SSO session from cookie
 * Validates sso_session cookie and populates req.ssoUser
 *
 * If no sso_session cookie is present but an active app_session cookie exists,
 * it will auto-create an SSO session from the app session (auto-login).
 * 
 * Usage:
 * router.get('/protected', authenticateSSO, (req, res) => {
 *   // req.ssoUser is populated
 * });
 */
export async function authenticateSSO(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let autoCreatedSession = false;

  try {
    // Try v2 Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = SessionV2.validateAccessToken(token);
        const isRevoked = await SessionV2.isTokenRevoked(payload.jti);
        if (isRevoked) {
          throw new AppError(401, 'Token revoked', 'TOKEN_REVOKED');
        }

        req.ssoUser = {
          sessionId: payload.jti,
          userId: payload.sub,
          email: '',
          firstName: '',
          lastName: '',
          userStatus: 'active',
          systemRole: payload.systemRole,
        };

        return next();
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Invalid access token', 'INVALID_ACCESS_TOKEN');
      }
    }

    // Fallback: SSO cookie-based auth
    let sessionToken = req.cookies?.sso_session;

    if (!sessionToken) {
      try {
        sessionToken = await tryAutoLoginFromAppSession(req, res);
        if (sessionToken) autoCreatedSession = true;
      } catch (_) {
        // Ignore auto-login errors and fall through
      }
    }

    if (!sessionToken) {
      throw new AppError(401, 'No SSO session', 'SSO_SESSION_REQUIRED');
    }

    // Validate session with service
    const user = await SSOSession.validateSession(sessionToken);

    // Populate request with user context
    req.ssoUser = user;

    next();
  } catch (error: unknown) {
    // If we auto-created an SSO session but validation failed, clean it up
    if (autoCreatedSession) {
      try {
        // The cookie was set via res.cookie, clear it
        res.clearCookie('sso_session', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          domain: process.env.COOKIE_DOMAIN,
        });
      } catch (_) {
        // Best-effort cleanup
      }
    }

    const isInvalidSession = 
      (error instanceof AppError && error.code === 'INVALID_SESSION') || 
      (error instanceof Error && error.message === 'INVALID_SESSION');
      
    if (isInvalidSession) {
      // Clear invalid cookie
      res.clearCookie('sso_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN,
      });
      return next(new AppError(401, 'Invalid SSO session', 'INVALID_SSO_SESSION'));
    }

    const isSessionExpired = 
      (error instanceof AppError && error.code === 'SESSION_EXPIRED') || 
      (error instanceof Error && error.message === 'SESSION_EXPIRED');

    if (isSessionExpired) {
      res.clearCookie('sso_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN,
      });
      return next(new AppError(401, 'SSO session expired', 'SSO_SESSION_EXPIRED'));
    }

    const isAccountNotActive = 
      (error instanceof AppError && error.code === 'ACCOUNT_NOT_ACTIVE') || 
      (error instanceof Error && error.message === 'ACCOUNT_NOT_ACTIVE');

    if (isAccountNotActive) {
      return next(new AppError(403, 'Account not active', 'ACCOUNT_NOT_ACTIVE'));
    }

    // Unknown error
    next(error);
  }
}

/**
 * Optional SSO authentication
 * Populates req.ssoUser if cookie is present, but doesn't fail if missing
 *
 * If no sso_session cookie is present but an active app_session cookie exists,
 * it will auto-create an SSO session from the app session (auto-login).
 * 
 * Usage:
 * router.get('/public-or-auth', optionalAuthenticateSSO, (req, res) => {
 *   if (req.ssoUser) {
 *     // Authenticated user
 *   } else {
 *     // Anonymous user
 *   }
 * });
 */
export async function optionalAuthenticateSSO(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try v2 Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = SessionV2.validateAccessToken(token);
        const isRevoked = await SessionV2.isTokenRevoked(payload.jti);
        if (!isRevoked) {
          req.ssoUser = {
            sessionId: payload.jti,
            userId: payload.sub,
            email: '',
            firstName: '',
            lastName: '',
            userStatus: 'active',
            systemRole: payload.systemRole,
          };
        }
      } catch (_) {
        // Invalid v2 token, continue as anonymous
      }
      return next();
    }

    // Fallback: cookie-based auth
    let sessionToken = req.cookies?.sso_session;

    if (!sessionToken) {
      try {
        sessionToken = await tryAutoLoginFromAppSession(req, res);
      } catch (_) {
        // Ignore auto-login errors and fall through
      }
    }

    if (!sessionToken) {
      // No cookie, continue as anonymous
      return next();
    }

    // Try to validate
    const user = await SSOSession.validateSession(sessionToken);
    req.ssoUser = user;

    next();
  } catch (error) {
    // Validation failed, clear cookie and continue as anonymous
    res.clearCookie('sso_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: process.env.COOKIE_DOMAIN,
    });
    next();
  }
}
