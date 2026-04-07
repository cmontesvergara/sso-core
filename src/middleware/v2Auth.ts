import { NextFunction, Request, Response } from 'express';
import { SessionV2, SessionV2Error } from '../services/sessionV2';
import { AppError } from './errorHandler';

interface V2User {
  userId: string;
  jti: string;
  tenants: Array<{
    id: string;
    role: string;
    apps: string[];
  }>;
  systemRole: string;
  deviceFingerprint?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    v2User?: V2User;
  }
}

export async function authenticateV2AccessToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing access token', 'MISSING_ACCESS_TOKEN');
    }

    const token = authHeader.substring(7);

    try {
      const payload = SessionV2.validateAccessToken(token);

      const isRevoked = await SessionV2.isTokenRevoked(payload.jti);
      if (isRevoked) {
        throw new AppError(401, 'Token has been revoked', 'TOKEN_REVOKED');
      }

      req.v2User = {
        userId: payload.sub,
        jti: payload.jti,
        tenants: payload.tenants,
        systemRole: payload.systemRole,
        deviceFingerprint: payload.deviceFingerprint,
      };

      next();
    } catch (error: any) {
      if (error instanceof SessionV2Error) {
        throw new AppError(401, error.message, error.code);
      }
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid access token', 'INVALID_ACCESS_TOKEN');
    }
  } catch (error) {
    next(error);
  }
}

export function requireV2SystemAdmin(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.v2User) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const allowedRoles = roles.length > 0 ? roles : ['super_admin', 'system_admin'];
    if (!allowedRoles.includes(req.v2User.systemRole)) {
      return next(new AppError(403, 'Insufficient privileges', 'INSUFFICIENT_PRIVILEGES'));
    }

    next();
  };
}