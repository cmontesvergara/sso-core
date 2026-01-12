import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';

export class AppError extends Error {
  public details?: any[];
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    details?: any[]
  ) {
    super(message);
    this.name = 'AppError';
    this.details = details;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  Logger.error('Error occurred:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';
  const payload: any = {
    error: code,
    message,
    timestamp: new Date().toISOString(),
  };
  if (err.details && Array.isArray(err.details)) payload.errors = err.details;
  if (process.env.NODE_ENV === 'development') payload.stack = err.stack;

  res.status(statusCode).json(payload);
}
