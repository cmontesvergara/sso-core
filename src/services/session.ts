import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import {
  findRefreshTokenByHash,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenById,
  saveRefreshToken,
} from '../repositories/refreshTokenRepo.prisma';
import { Logger } from '../utils/logger';
import { JWT } from './jwt';

const PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'change-me-pepper';

function hashToken(token: string) {
  return crypto.createHmac('sha256', PEPPER).update(token).digest('hex');
}

export async function initSessionSubsystem() {
  // Tables initialized by node-pg-migrate migrations
  // Prisma client lazily initialized on first use
  Logger.info('Session subsystem ready (tables managed by migrations)');
}

export async function generateRefreshToken(userId: string, clientId?: string | null, meta?: { ip?: string; ua?: string }) {
  const token = uuidv4();
  const hash = hashToken(token);
  const validitySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '2592000', 10));
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  const row = await saveRefreshToken({
    user_id: userId,
    token_hash: hash,
    client_id: clientId || undefined,
    expires_at: expiresAt,
    ip: meta?.ip || undefined,
    user_agent: meta?.ua || undefined,
  });
  return { token, row };
}

export class SessionError extends Error {}

export async function rotateRefreshToken(refreshTokenPlain: string) {
  const hash = hashToken(refreshTokenPlain);
  const row = await findRefreshTokenByHash(hash);
  if (!row) throw new SessionError('INVALID_REFRESH_TOKEN');
  if (row.revoked) {
    if (row.userId) await revokeAllRefreshTokensForUser(row.userId);
    throw new SessionError('REFRESH_TOKEN_REUSED');
  }
  if (new Date(row.expiresAt) < new Date()) {
    throw new SessionError('REFRESH_TOKEN_EXPIRED');
  }

  await revokeRefreshTokenById(row.id);
  const newTokenPlain = uuidv4();
  const newHash = hashToken(newTokenPlain);
  const validitySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '2592000', 10));
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  await saveRefreshToken({
    user_id: row.userId,
    token_hash: newHash,
    client_id: row.clientId || undefined,
    expires_at: expiresAt,
    previous_token_id: row.id,
    ip: row.ip || undefined,
    user_agent: row.userAgent || undefined,
  });

  const accessValidity = Config.get('access_token_validity', parseInt(process.env.ACCESS_TOKEN_VALIDITY || '900', 10));
  const accessToken = JWT.generateToken({ sub: row.userId }, accessValidity);

  return { accessToken, refreshToken: newTokenPlain, expiresIn: accessValidity };
}

export async function revokeRefreshTokenPlain(refreshTokenPlain: string, revokeAllForUser = false) {
  const hash = hashToken(refreshTokenPlain);
  const row = await findRefreshTokenByHash(hash);
  if (!row) return false;
  await revokeRefreshTokenById(row.id);
  if (revokeAllForUser && row.userId) {
    await revokeAllRefreshTokensForUser(row.userId);
  }
  return true;
}
