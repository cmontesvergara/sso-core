import { NextFunction, Request, Response } from 'express';
import {
  findAppSessionByToken,
  updateAppSessionActivity,
} from '../repositories/appSessionRepo.prisma';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  tenant?: {
    tenantId: string;
    name: string;
    slug: string;
  };
  session?: {
    appId: string;
    role: string;
    sessionToken: string;
    expiresAt: Date;
  };
  tenantMembership?: {
    role: string;
    tenantId: string;
    userId: string;
  };
}

/**
 * Middleware to authenticate app sessions
 * Validates session token from cookie or Authorization header
 * Populates req.user, req.tenant, and req.session with context
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try to get token from cookie first, then Authorization header
    const token = req.cookies?.app_session || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError(401, 'Missing session token', 'UNAUTHORIZED');
    }

    // Validate session against database
    const session = await findAppSessionByToken(token);

    if (!session) {
      throw new AppError(401, 'Invalid session token', 'INVALID_SESSION');
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      throw new AppError(401, 'Session has expired', 'SESSION_EXPIRED');
    }

    // Update last activity timestamp (fire and forget)
    updateAppSessionActivity(token).catch((err) =>
      console.error('Failed to update session activity:', err)
    );

    // Populate request with authenticated context
    req.user = {
      userId: session.userId,
      tenantId: session.tenantId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    };

    req.tenant = {
      tenantId: session.tenantId,
      name: session.tenant.name,
      slug: session.tenant.slug,
    };

    req.session = {
      appId: session.appId,
      role: session.role,
      sessionToken: token,
      expiresAt: session.expiresAt,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Continues without throwing error if no token is provided
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.app_session || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const session = await findAppSessionByToken(token);

      if (session && new Date(session.expiresAt) >= new Date()) {
        // Valid session found
        req.user = {
          userId: session.userId,
          tenantId: session.tenantId,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
        };

        req.tenant = {
          tenantId: session.tenantId,
          name: session.tenant.name,
          slug: session.tenant.slug,
        };

        req.session = {
          appId: session.appId,
          role: session.role,
          sessionToken: token,
          expiresAt: session.expiresAt,
        };
      }
    }

    // Continue regardless of authentication status
    next();
  } catch (error) {
    // Continue without auth if optional
    next();
  }
}
