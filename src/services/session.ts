import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import { initPg } from '../database/pg';
import {
  findRefreshTokenByHash,
  initRefreshTokensTable,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenById,
  saveRefreshToken
} from '../repositories/refreshTokenRepo';
import { JWT } from './jwt';

const PEPPER = process.env.REFRESH_TOKEN_PEPPER || 'change-me-pepper';

function hashToken(token: string) {
  return crypto.createHmac('sha256', PEPPER).update(token).digest('hex');
}

export async function initSessionSubsystem() {
  await initPg();
  await initRefreshTokensTable();
}

export async function generateRefreshToken(userId: string | null, clientId?: string | null, meta?: { ip?: string; ua?: string }) {
  const token = uuidv4();
  const hash = hashToken(token);
  const validitySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '2592000', 10));
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  const row = await saveRefreshToken({ user_id: userId, token_hash: hash, client_id: clientId || null, expires_at: expiresAt, ip: meta?.ip || null, user_agent: meta?.ua || null });
  return { token, row };
}

export class SessionError extends Error {}

export async function rotateRefreshToken(refreshTokenPlain: string) {
  const hash = hashToken(refreshTokenPlain);
  const row = await findRefreshTokenByHash(hash);
  if (!row) throw new SessionError('INVALID_REFRESH_TOKEN');
  if (row.revoked) {
    // possible reuse attack: revoke all user tokens
    if (row.user_id) await revokeAllRefreshTokensForUser(row.user_id);
    throw new SessionError('REFRESH_TOKEN_REUSED');
  }
  if (new Date(row.expires_at) < new Date()) {
    throw new SessionError('REFRESH_TOKEN_EXPIRED');
  }

  // Revoke current token and create a new one
  await revokeRefreshTokenById(row.id);
  const newTokenPlain = uuidv4();
  const newHash = hashToken(newTokenPlain);
  const validitySeconds = Config.get('refresh_token_validity', parseInt(process.env.REFRESH_TOKEN_VALIDITY || '2592000', 10));
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  await saveRefreshToken({ user_id: row.user_id || null, token_hash: newHash, client_id: row.client_id || null, expires_at: expiresAt, previous_token_id: row.id, ip: row.ip || null, user_agent: row.user_agent || null });

  // Issue access token
  const accessValidity = Config.get('access_token_validity', parseInt(process.env.ACCESS_TOKEN_VALIDITY || '900', 10));
  const accessToken = JWT.generateToken({ sub: row.user_id }, accessValidity);

  return { accessToken, refreshToken: newTokenPlain, expiresIn: accessValidity };
}

