import { getPool } from '../database/pg';

export interface RefreshTokenRow {
  id: string;
  user_id: string | null;
  token_hash: string;
  client_id: string | null;
  created_at: Date;
  expires_at: Date;
  revoked: boolean;
  previous_token_id: string | null;
  ip: string | null;
  user_agent: string | null;
}

export async function initRefreshTokensTable(): Promise<void> {
  // ensure pgcrypto extension (gen_random_uuid) is available
  const pool = getPool();
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  const sql = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    token_hash TEXT NOT NULL,
    client_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    previous_token_id UUID,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  `;
  await pool.query(sql);
}

export async function saveRefreshToken(params: {
  id?: string;
  user_id?: string | null;
  token_hash: string;
  client_id?: string | null;
  expires_at: Date;
  previous_token_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
}) {
  const { user_id, token_hash, client_id, expires_at, previous_token_id, ip, user_agent } = params;
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO refresh_tokens(user_id, token_hash, client_id, expires_at, previous_token_id, ip, user_agent) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [user_id || null, token_hash, client_id || null, expires_at, previous_token_id || null, ip || null, user_agent || null]
  );
  return res.rows[0] as RefreshTokenRow;
}

export async function findRefreshTokenByHash(token_hash: string) {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`, [token_hash]);
  return res.rows[0] as RefreshTokenRow | undefined;
}

export async function revokeRefreshTokenById(id: string) {
  const pool = getPool();
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [id]);
}

export async function revokeAllRefreshTokensForUser(user_id: string) {
  const pool = getPool();
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [user_id]);
}
