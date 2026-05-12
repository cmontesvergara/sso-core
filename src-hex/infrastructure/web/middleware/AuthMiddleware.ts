import { Request, Response, NextFunction } from 'express';
import { VerifySessionUseCase } from '../../../application/use-cases/auth/VerifySessionUseCase';
import { SessionExpiredError } from '../../../domain/errors/SessionExpiredError';
import { SessionNotFoundError } from '../../../domain/errors/SessionNotFoundError';

/**
 * AuthMiddleware
 * Validates the Bearer token on every protected route.
 * Injects userId and sessionId into req for downstream controllers.
 */
export function createAuthMiddleware(verifySessionUseCase: VerifySessionUseCase) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const result = await verifySessionUseCase.execute({
        accessToken: token,
        ip: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] as string,
      });
      (req as any).userId = result.userId;
      (req as any).sessionId = result.sessionId;
      (req as any).tokenClaims = result.claims;
      next();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        res.status(401).json({ error: 'TokenExpired', message: 'Session has expired' });
      } else if (err instanceof SessionNotFoundError) {
        res.status(401).json({ error: 'Unauthorized', message: 'Session not found' });
      } else {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
      }
    }
  };
}
