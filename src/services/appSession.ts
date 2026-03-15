import { Config } from '../config';
import {
  extendAppSession,
} from '../repositories/appSessionRepo.prisma';
import {
  findRefreshTokenByHash,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenById,
  saveRefreshToken,
} from '../repositories/refreshTokenRepo.prisma';
import { SessionError } from './session';
import { JWT } from './jwt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'change-me-pepper';

function hashToken(token: string) {
  return crypto.createHmac('sha256', PEPPER).update(token).digest('hex');
}

export class AppSessionService {
  private static instance: AppSessionService;

  private constructor() {}

  static getInstance(): AppSessionService {
    if (!AppSessionService.instance) {
      AppSessionService.instance = new AppSessionService();
    }
    return AppSessionService.instance;
  }

  /**
   * Generates a new refresh token specifically linked to an app
   */
  async generateAppRefreshToken(userId: string, appId: string, meta?: { ip?: string; ua?: string }) {
    const token = uuidv4();
    const hash = hashToken(token);
    
    // Refresh token lives longer than the app session itself (e.g., 7 days)
    const validitySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '604800', 10));
    const expiresAt = new Date(Date.now() + validitySeconds * 1000);
    
    const row = await saveRefreshToken({
      user_id: userId,
      token_hash: hash,
      client_id: appId,
      expires_at: expiresAt,
      ip: meta?.ip || undefined,
      user_agent: meta?.ua || undefined,
    });
    
    return { token, expiresAt, row };
  }

  /**
   * Rotates an app refresh token and extends the app session
   */
  async rotateAppRefreshToken(refreshTokenPlain: string, appId: string) {
    const hash = hashToken(refreshTokenPlain);
    const row = await findRefreshTokenByHash(hash);
    
    if (!row) throw new SessionError('INVALID_REFRESH_TOKEN');
    
    // Ensure the refresh token belongs to this app
    if (row.clientId !== appId) {
      throw new SessionError('INVALID_REFRESH_TOKEN_FOR_APP');
    }

    if (row.revoked) {
      if (row.userId) await revokeAllRefreshTokensForUser(row.userId);
      throw new SessionError('REFRESH_TOKEN_REUSED');
    }
    
    if (new Date(row.expiresAt) < new Date()) {
      throw new SessionError('REFRESH_TOKEN_EXPIRED');
    }

    // Revoke old, generate new
    await revokeRefreshTokenById(row.id);
    const newTokenPlain = uuidv4();
    const newHash = hashToken(newTokenPlain);
    
    const refreshValiditySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '604800', 10));
    const refreshExpiresAt = new Date(Date.now() + refreshValiditySeconds * 1000);
    
    await saveRefreshToken({
      user_id: row.userId,
      token_hash: newHash,
      client_id: appId,
      expires_at: refreshExpiresAt,
      previous_token_id: row.id,
      ip: row.ip || undefined,
      user_agent: row.userAgent || undefined,
    });

    // We must find the active app session to know the tenantId and role
    // NOTE: In a real scenario, the app session might just have expired.
    // If we use findAppSessionByAppAndUser, it filters by `expiresAt > Date.now()`.
    // We should allow renewing even if the app session just expired, as long as the refresh token is valid.
    
    const { getPrismaClient } = await import('../services/prisma');
    const prisma = getPrismaClient();

    // Find the latest app session regardless of its standard expiration,
    // as the whole point of a refresh token is to renew it when it expires.
    const appSession = await prisma.appSession.findFirst({
        where: {
            appId,
            userId: row.userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
          user: true,
          tenant: true
        }
    });

    if (!appSession) {
      throw new SessionError('NO_APP_SESSION_FOUND');
    }

    // Generate new JWT
    const sessionValiditySeconds = Config.get('session.expiry_time', 3600); 
    const sessionExpiresAt = new Date(Date.now() + sessionValiditySeconds * 1000);

    const sessionToken = JWT.generateToken({
      userId: appSession.user.id,
      tenantId: appSession.tenant.id,
      appId: appId,
      role: appSession.role,
    }, sessionValiditySeconds);

    // Update app session in DB
    await extendAppSession(appSession.sessionToken, sessionExpiresAt);
    
    // Actually we need to update the session token itself in the DB if we want verification to work via DB
    // since the sessionToken acts as the ID in verification.
    // However, extendAppSession only updates expiresAt and lastActivityAt.
    // Let's manually upate the token.
    await prisma.appSession.update({
        where: { id: appSession.id },
        data: {
            sessionToken: sessionToken,
            expiresAt: sessionExpiresAt,
            lastActivityAt: new Date()
        }
    });

    return { 
        sessionToken, 
        refreshToken: newTokenPlain, 
        expiresAt: sessionExpiresAt,
        refreshExpiresAt: refreshExpiresAt
    };
  }
}

export const AppSession = AppSessionService.getInstance();
