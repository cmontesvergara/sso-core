import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Log request
  Logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });

  // Capture response
  const originalSend = res.send;

  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;

    Logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      duration: `${duration}ms`,
    });

    return originalSend.call(this, data);
  };

  next();
}
