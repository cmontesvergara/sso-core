import { NextFunction, Request, Response } from 'express';
import { SSOSession } from '../services/ssoSession';
import { AppError } from './errorHandler';

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
 * Middleware to authenticate SSO session from cookie
 * Validates sso_session cookie and populates req.ssoUser
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
  try {
    // Get session token from cookie
    const sessionToken = req.cookies?.sso_session;

    if (!sessionToken) {
      throw new AppError(401, 'No SSO session', 'SSO_SESSION_REQUIRED');
    }

    // Validate session with service
    const user = await SSOSession.validateSession(sessionToken);

    // Populate request with user context
    req.ssoUser = user;

    next();
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === 'INVALID_SESSION') {
      // Clear invalid cookie
      res.clearCookie('sso_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN,
      });
      return next(new AppError(401, 'Invalid SSO session', 'INVALID_SSO_SESSION'));
    }

    if (error instanceof AppError && error.code === 'SESSION_EXPIRED') {
      res.clearCookie('sso_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN,
      });
      return next(new AppError(401, 'SSO session expired', 'SSO_SESSION_EXPIRED'));
    }

    if (error instanceof AppError && error.code === 'ACCOUNT_NOT_ACTIVE') {
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
    const sessionToken = req.cookies?.sso_session;

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
