/**
 * Container Configuration
 * Registers all services and repositories in the DI container
 */

import { Container } from './infrastructure/container';
import { getPrismaClient } from '../services/prisma';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { PrismaClient } from '@prisma/client';
import { SsoSessionService } from '../services/session/sso-session.service';
import { AppSessionService } from '../services/session/app-session.service';
import { RefreshTokenService } from '../services/session/refresh-token.service';
import { TokenValidatorService } from '../services/session/token-validator.service';
import { SessionRevokerService } from '../services/session/session-revoker.service';
import { RedisSessionService } from '../services/session/redis-session.service';
import { AuthServiceV2 } from '../services/authV2';
import { JWT } from '../services/jwt';

/**
 * Configure and return the global container with all services registered
 */
export function configureContainer(): Container {
  const container = new Container();

  // Prisma Client (singleton from existing infrastructure)
  const prisma = getPrismaClient() as PrismaClient;
  container.instance('PrismaClient', prisma);

  // Repositories
  container.singleton('UserRepository', (c) => {
    return new UserRepository(prisma);
  });

  container.singleton('SessionRepository', (c) => {
    return new SessionRepository(prisma);
  });

  container.singleton('RefreshTokenRepository', (c) => {
    return new RefreshTokenRepository(prisma);
  });

  // Redis Session Service
  container.singleton('RedisSessionService', () => {
    return new RedisSessionService();
  });

  // Session Services
  container.singleton('SsoSessionService', (c) => {
    return new SsoSessionService(
      c.get('SessionRepository'),
      c.get('RedisSessionService')
    );
  });

  container.singleton('AppSessionService', (c) => {
    return new AppSessionService(
      c.get('SessionRepository'),
      c.get('RedisSessionService')
    );
  });

  container.singleton('RefreshTokenService', (c) => {
    return new RefreshTokenService(
      c.get('RefreshTokenRepository'),
      c.get('RedisSessionService'),
      c.get('AppSessionService')
    );
  });

  container.singleton('TokenValidatorService', (c) => {
    return new TokenValidatorService(
      c.get('SessionRepository'),
      c.get('RedisSessionService')
    );
  });

  container.singleton('SessionRevokerService', (c) => {
    return new SessionRevokerService(
      c.get('SessionRepository'),
      c.get('RefreshTokenRepository'),
      c.get('RedisSessionService')
    );
  });

  // JWT Service (existing singleton, registered as instance)
  container.instance('JWTService', JWT);

  // Auth Service V2
  container.singleton('AuthServiceV2', (c) => {
    return new AuthServiceV2(
      c.get('UserRepository'),
      c.get('SsoSessionService'),
      c.get('AppSessionService'),
      c.get('RefreshTokenService'),
      c.get('TokenValidatorService'),
      c.get('SessionRevokerService')
    );
  });

  return container;
}

// Global container instance
let globalContainer: Container | null = null;

/**
 * Get or create the global container instance
 */
export function getContainer(): Container {
  if (!globalContainer) {
    globalContainer = configureContainer();
  }
  return globalContainer;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  globalContainer = null;
}
