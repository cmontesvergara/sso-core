import { Pool } from 'pg';
import { Config } from '../config';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
      const connectionString = `postgres://${Config.get('database.user')}:${encodeURIComponent(Config.get('database.password'))}@${Config.get('database.host')}:${Config.get('database.port')}/${Config.get('database.name')}`;
      
      console.log(`Connecting to Postgres with connection string: ${connectionString}`);
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function initPg(): Promise<void> {
  try {
    const p = getPool();
    // simple test
    await p.query('SELECT 1');
  } catch (err) {
    console.error('Postgres connection failed:', err);
    throw err;
  }
}

export { pool };
