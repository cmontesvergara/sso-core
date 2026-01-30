import { NextFunction, Response } from 'express';
import { findUserById } from '../repositories/userRepo.prisma';
import { AuthenticatedRequest } from './auth';
import { AppError } from './errorHandler';

/**
 * Middleware to verify user has system admin privileges
 * Requires authMiddleware to run first
 */
export async function systemAdminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const user = await findUserById(req.user.userId);

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
 * Requires authMiddleware to run first
 */
export async function superAdminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const user = await findUserById(req.user.userId);

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
