import { Logger } from '../utils/logger';
import {
  createRedisAuthCode,
  exchangeRedisAuthCode,
  deleteRedisAuthCode,
  generateAuthCode,
} from '../repositories/redisAuthCodeRepo';
import { revokeAllRedisUserSessions } from '../repositories/redisSessionRepo';
import type { RedisAuthCodeData } from '../core/dtos/auth-v2.dto';

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

    await createRedisAuthCode({
      code,
      userId,
      tenantId,
      appId,
      codeChallenge,
      codeChallengeMethod,
    });

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
  ): Promise<RedisAuthCodeData> {
    const result = await exchangeRedisAuthCode(code, appId, codeVerifier);

    if (!result.success) {
      if (result.error === 'CODE_REUSE_DETECTED' && result.data) {
        await revokeAllRedisUserSessions(result.data.userId);
        Logger.warn('Auth code reuse detected - all sessions revoked', {
          userId: result.data.userId,
        });
      }

      throw new Error(result.error || 'INVALID_AUTH_CODE');
    }

    if (!result.data) {
      throw new Error('INVALID_AUTH_CODE');
    }

    Logger.info('Auth code v2 exchanged', {
      userId: result.data.userId,
      appId: result.data.appId,
    });

    return result.data;
  }

  async revokeCode(code: string): Promise<void> {
    await deleteRedisAuthCode(code);
  }
}

export const AuthCodeV2 = AuthCodeV2Service.getInstance();