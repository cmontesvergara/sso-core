import { NextFunction, Request, Response } from 'express';
import { findUserById } from '../repositories/userRepo.prisma';
import { AppError } from './errorHandler';

/**
 * Middleware to verify user has system admin privileges
 * Works with authenticateSSO middleware (uses req.ssoUser)
 *
 * Requires: authenticateSSO middleware to run first
 */
export async function requireSystemAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.ssoUser?.userId) {
      throw new AppError(401, 'SSO authentication required', 'UNAUTHORIZED');
    }

    const user = await findUserById(req.ssoUser.userId);

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (user.systemRole !== 'super_admin' && user.systemRole !== 'system_admin') {
      throw new AppError(403, 'System admin privileges required', 'INSUFFICIENT_PRIVILEGES');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to verify user has super admin privileges
 * Works with authenticateSSO middleware (uses req.ssoUser)
 *
 * Requires: authenticateSSO middleware to run first
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.ssoUser?.userId) {
      throw new AppError(401, 'SSO authentication required', 'UNAUTHORIZED');
    }

    const user = await findUserById(req.ssoUser.userId);

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (user.systemRole !== 'super_admin') {
      throw new AppError(403, 'Super admin privileges required', 'INSUFFICIENT_PRIVILEGES');
    }

    next();
  } catch (error) {
    next(error);
  }
}
