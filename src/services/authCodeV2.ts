import { Logger } from '../utils/logger';
import { isRedisAvailable } from '../services/redis';
import {
  createRedisAuthCode,
  exchangeRedisAuthCode,
  deleteRedisAuthCode,
  generateAuthCode,
  verifyPKCE,
} from '../repositories/redisAuthCodeRepo';
import {
  createAuthCode as createPgAuthCode,
  findAuthCodeByCode as findPgAuthCodeByCode,
  markAuthCodeAsUsed as markPgAuthCodeAsUsed,
  deleteAuthCode as deletePgAuthCode,
} from '../repositories/authCodeRepo.prisma';

export class AuthCodeV2Service {
  private static instance: AuthCodeV2Service;

  private constructor() {}

  static getInstance(): AuthCodeV2Service {
    if (!AuthCodeV2Service.instance) {
      AuthCodeV2Service.instance = new AuthCodeV2Service();
    }
    return AuthCodeV2Service.instance;
  }

  async generateCode(
    userId: string,
    tenantId: string,
    appId: string,
    codeChallenge: string,
    codeChallengeMethod: string = 'S256'
  ): Promise<{ code: string; expiresIn: number }> {
    const code = generateAuthCode();
    const expiresAt = new Date(Date.now() + 300 * 1000);

    // Always write to PG
    await createPgAuthCode({
      code,
      user_id: userId,
      tenant_id: tenantId,
      app_id: appId,
      redirect_uri: '',
      sso_session_id: null,
      expires_at: expiresAt,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    });

    // Best-effort write to Redis (fast lookup)
    try {
      if (isRedisAvailable()) {
        await createRedisAuthCode({
          code,
          userId,
          tenantId,
          appId,
          codeChallenge,
          codeChallengeMethod,
        });
      }
    } catch (err) {
      Logger.warn('Redis write failed for auth code, stored in PG only', { code: code.substring(0, 10), error: err });
    }

    Logger.info('Auth code v2 generated', {
      code: code.substring(0, 10) + '...',
      userId,
      tenantId,
      appId,
    });

    return { code, expiresIn: 300 };
  }

  async exchangeCode(
    code: string,
    appId: string,
    codeVerifier: string
  ): Promise<{
    userId: string;
    tenantId: string;
    appId: string;
  }> {
    // Try Redis first (fast path, atomic GET+DEL)
    try {
      if (isRedisAvailable()) {
        const result = await exchangeRedisAuthCode(code, appId, codeVerifier);

        if (result.success && result.data) {
          // Also mark as used in PG
          try { await markPgAuthCodeAsUsed(code); } catch (_) {}

          return {
            userId: result.data.userId,
            tenantId: result.data.tenantId,
            appId: result.data.appId,
          };
        }

        // Redis returned an error
        if (result.error === 'CODE_REUSE_DETECTED') {
          if (result.data) {
            const { revokeAllRedisUserSessions } = await import('../repositories/redisSessionRepo');
            await revokeAllRedisUserSessions(result.data.userId);
            await (await import('../repositories/ssoSessionRepo.prisma')).deleteAllSSOSessionsForUser(result.data.userId);
            await (await import('../repositories/refreshTokenRepo.prisma')).revokeAllRefreshTokensForUser(result.data.userId);
            Logger.warn('Auth code reuse detected - all sessions revoked', { userId: result.data.userId });
          }
          throw new Error('CODE_REUSE_DETECTED');
        }

        // Code not found in Redis (expired or was never in Redis), fall through to PG
        if (result.error === 'INVALID_AUTH_CODE') {
          // Don't throw yet, try PG
        } else {
          throw new Error(result.error || 'INVALID_AUTH_CODE');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'CODE_REUSE_DETECTED') throw err;
      if (err instanceof Error && err.message !== 'INVALID_AUTH_CODE') throw err;
      Logger.warn('Redis read failed during code exchange, falling back to PG', { error: err });
    }

    // PG path
    const authCode: any = await findPgAuthCodeByCode(code);

    if (!authCode) {
      throw new Error('INVALID_AUTH_CODE');
    }

    if (authCode.used) {
      Logger.warn('Auth code already used (PG)', { code: code.substring(0, 10) });
      throw new Error('CODE_ALREADY_USED');
    }

    if (new Date() > new Date(authCode.expiresAt)) {
      await deletePgAuthCode(code);
      throw new Error('CODE_EXPIRED');
    }

    if (authCode.appId !== appId) {
      throw new Error('APP_MISMATCH');
    }

    if (authCode.codeChallenge) {
      if (!verifyPKCE(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod || 'S256')) {
        throw new Error('INVALID_CODE_VERIFIER');
      }
    }

    // Mark as used in PG
    await markPgAuthCodeAsUsed(code);

    // Also delete from Redis if somehow still there
    try { await deleteRedisAuthCode(code); } catch (_) {}

    return {
      userId: authCode.userId,
      tenantId: authCode.tenantId,
      appId: authCode.appId,
    };
  }

  async revokeCode(code: string): Promise<void> {
    // Clean up both stores
    try { await deleteRedisAuthCode(code); } catch (_) {}
    try { await deletePgAuthCode(code); } catch (_) {}
  }
}

export const AuthCodeV2 = AuthCodeV2Service.getInstance();