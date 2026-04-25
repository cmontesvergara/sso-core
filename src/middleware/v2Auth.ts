import { NextFunction, Request, Response } from 'express';
import { getContainer } from '../core/container-config';
import { SessionValidationError } from '../services/session/app-session.service';
import { RefreshTokenValidationError } from '../services/session/refresh-token.service';
import { TokenValidatorService } from '../services/session/token-validator.service';
import { AppError } from './errorHandler';

// Service instance from container
const tokenValidator = () => getContainer().get<TokenValidatorService>('TokenValidatorService');

interface V2User {
  userId: string;
  jti: string;
  type: 'sso' | 'app';
  appId?: string;
  tenantId?: string;
  systemRole: string;
  deviceFingerprint?: string;
  scope?: string[];
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
  const { Logger } = await import('../utils/logger');
  Logger.debug('[v2Auth] authenticateV2AccessToken called', { path: req.path, method: req.method });

  try {
    const authHeader = req.headers.authorization;
    Logger.debug('[v2Auth] Authorization header', { hasAuth: !!authHeader, startsWithBearer: authHeader?.startsWith('Bearer ') });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing access token', 'MISSING_ACCESS_TOKEN');
    }

    const token = authHeader.substring(7);
    Logger.debug('[v2Auth] Token extracted', { tokenPreview: token.substring(0, 30) + '...' });

    try {
      Logger.debug('[v2Auth] Calling tokenValidator...');
      const validation = await tokenValidator().validateToken(token, req.path.includes('authorize') ? 'sso' : 'app');
      Logger.debug('[v2Auth] Validation result', { isValid: validation.isValid, error: validation.error });

      if (!validation.isValid || !validation.decoded) {
        throw new AppError(401, 'Invalid access token', validation.error || 'INVALID_ACCESS_TOKEN');
      }

      const payload = validation.decoded;
      const sessionType = payload.type === 'sso' ? 'sso' : 'app';
      Logger.debug('[v2Auth] Token valid, checking revocation', { jti: payload.jti, sessionType });

      const isRevoked = await tokenValidator().isTokenRevoked(payload.jti, sessionType);
      Logger.debug('[v2Auth] Revocation check result', { isRevoked });

      if (isRevoked) {
        throw new AppError(401, 'Token has been revoked', 'TOKEN_REVOKED');
      }

      req.v2User = {
        userId: payload.sub,
        jti: payload.jti,
        type: payload.type,
        appId: payload.appId,
        tenantId: payload.tenantId,
        systemRole: payload.systemRole,
        deviceFingerprint: payload.deviceFingerprint,
        scope: payload.scope,
      };

      Logger.debug('[v2Auth] Authentication successful', { userId: payload.sub, type: payload.type });
      next();
    } catch (error: any) {
      Logger.debug('[v2Auth] Error in validation', { error: error.message, code: error.code });
      if (error instanceof RefreshTokenValidationError || error instanceof SessionValidationError) {
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