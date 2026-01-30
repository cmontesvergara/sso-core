import { NextFunction, Request, Response } from 'express';
import {
    findAppSessionByToken,
    updateAppSessionActivity,
} from '../repositories/appSessionRepo.prisma';
import { AppError } from './errorHandler';

/**
 * Extend Express Request to include App Session context
 */
declare global {
  namespace Express {
    interface Request {
      appSession?: {
        sessionId: string;
        appId: string;
        userId: string;
        tenantId: string;
        role: string;
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
        tenant: {
          id: string;
          name: string;
          slug: string;
        };
      };
    }
  }
}

/**
 * Middleware to authenticate app session from session token
 * This is used by APP backends (not SSO portal) to validate their app_session tokens
 *
 * Usage in App Backend:
 * ```typescript
 * // In your CRM backend:
 * import { authenticateApp } from '@sso/middleware';
 *
 * app.get('/api/customers', authenticateApp, (req, res) => {
 *   // req.appSession is populated with user + tenant context
 *   const tenantId = req.appSession.tenant.id;
 *   const userId = req.appSession.user.id;
 *   // ... business logic
 * });
 * ```
 *
 * Expected request:
 * - Header: Authorization: Bearer <sessionToken>
 * - OR Cookie: app_session=<sessionToken>
 */
export async function authenticateApp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get session token from Authorization header or cookie
    let sessionToken: string | undefined;

    // Try Authorization header first (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }

    // Fallback to cookie
    if (!sessionToken) {
      sessionToken = req.cookies?.app_session;
    }

    if (!sessionToken) {
      throw new AppError(401, 'No app session provided', 'APP_SESSION_REQUIRED');
    }

    // Find and validate session
    const appSession = await findAppSessionByToken(sessionToken);

    if (!appSession) {
      throw new AppError(401, 'Invalid app session', 'INVALID_APP_SESSION');
    }

    // Check if session is expired
    if (appSession.expiresAt < new Date()) {
      throw new AppError(401, 'App session expired', 'APP_SESSION_EXPIRED');
    }

    // Update last activity timestamp (async, don't wait)
    updateAppSessionActivity(sessionToken).catch((err) => {
      console.error('Failed to update app session activity:', err);
    });

    // Populate request with app session context
    req.appSession = {
      sessionId: appSession.id,
      appId: appSession.appId,
      userId: appSession.userId,
      tenantId: appSession.tenantId,
      role: appSession.role,
      user: {
        id: appSession.user.id,
        email: appSession.user.email,
        firstName: appSession.user.firstName,
        lastName: appSession.user.lastName,
      },
      tenant: {
        id: appSession.tenant.id,
        name: appSession.tenant.name,
        slug: appSession.tenant.slug,
      },
    };

    next();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      // Clear invalid cookie if present
      if (error.code === 'INVALID_APP_SESSION' || error.code === 'APP_SESSION_EXPIRED') {
        res.clearCookie('app_session', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
      }
      return next(error);
    }

    // Unknown error
    next(error);
  }
}

/**
 * Optional app authentication middleware
 * Populates req.appSession if valid session exists, but doesn't fail if missing
 *
 * Usage:
 * ```typescript
 * app.get('/api/public-data', optionalAppAuth, (req, res) => {
 *   if (req.appSession) {
 *     // User is authenticated, provide personalized data
 *   } else {
 *     // User is anonymous, provide public data
 *   }
 * });
 * ```
 */
export async function optionalAppAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get session token from Authorization header or cookie
    let sessionToken: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }

    if (!sessionToken) {
      sessionToken = req.cookies?.app_session;
    }

    // If no token, just continue without auth
    if (!sessionToken) {
      return next();
    }

    // Validate session
    const appSession = await findAppSessionByToken(sessionToken);

    // If invalid or expired, continue without auth
    if (!appSession || appSession.expiresAt < new Date()) {
      return next();
    }

    // Update activity timestamp
    updateAppSessionActivity(sessionToken).catch((err) => {
      console.error('Failed to update app session activity:', err);
    });

    // Populate request context
    req.appSession = {
      sessionId: appSession.id,
      appId: appSession.appId,
      userId: appSession.userId,
      tenantId: appSession.tenantId,
      role: appSession.role,
      user: {
        id: appSession.user.id,
        email: appSession.user.email,
        firstName: appSession.user.firstName,
        lastName: appSession.user.lastName,
      },
      tenant: {
        id: appSession.tenant.id,
        name: appSession.tenant.name,
        slug: appSession.tenant.slug,
      },
    };

    next();
  } catch (error) {
    // On error, just continue without auth (optional middleware)
    next();
  }
}

/**
 * Middleware to check tenant-level role permissions in apps
 * Must be used AFTER authenticateApp middleware
 *
 * Usage:
 * ```typescript
 * app.post('/api/admin/users',
 *   authenticateApp,
 *   requireAppRole(['admin']),
 *   (req, res) => {
 *     // Only tenant admins can access this
 *   }
 * );
 * ```
 */
export function requireAppRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.appSession) {
      return next(new AppError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }

    const userRole = req.appSession.role;

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError(
          403,
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}
