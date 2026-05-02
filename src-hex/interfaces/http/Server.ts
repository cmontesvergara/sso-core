import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Container } from '../../infrastructure/config/Container';
import { errorHandlerMiddleware } from '../../infrastructure/web/middleware/ErrorHandlerMiddleware';
import { createRouter } from '../../infrastructure/web/routes/index';

/**
 * createHexServer
 * Builds the Express application for the hexagonal architecture mode.
 * Mounts all routes under /api/v3.
 * Keeps /health and /.well-known/jwks.json compatible with legacy monitors.
 */
export async function createHexServer(container: Container): Promise<Express> {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ── Infrastructure routes (no auth, no rate limit penalty) ───────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', mode: 'hexagonal', timestamp: new Date().toISOString() });
  });

  // JWKS endpoint (Publicly accessible globally for CORS)
  app.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
    try {
      const jwksProvider = container.get<any>('JwksProvider');
      const jwksString = jwksProvider.getJwksString();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(jwksString);
    } catch (err: any) {
      res.status(500).json({ error: 'JWKS not initialized', message: err.message });
    }
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.json({ status: 'OK', mode: 'hexagonal', timestamp: new Date().toISOString() });
  });

  // ── API v3 (hexagonal) ───────────────────────────────────────────────────
  app.use('/api/v2', createRouter(container));

  // ── 404 ──────────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandlerMiddleware);

  return app;
}
