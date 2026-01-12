import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId?: string;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError(401, 'Missing authorization token', 'UNAUTHORIZED');
    }

    // TODO: Validate JWT token
    // For now, just verify it exists
    req.user = {
      userId: 'user-id', // This would be extracted from token
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // TODO: Validate JWT token
      req.user = {
        userId: 'user-id',
      };
    }

    next();
  } catch (error) {
    // Continue without auth if optional
    next();
  }
}
