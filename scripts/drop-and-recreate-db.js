const { Client } = require('pg');

async function dropAndRecreateDB() {
  const client = new Client({
    host: '200.45.208.239',
    port: 5432,
    user: 'postgres',
    password: '@Password21',
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL server');

    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'bigso_sso'
        AND pid <> pg_backend_pid();
    `);
    console.log('👥 Disconnected all users from bigso_sso');

    await client.query('DROP DATABASE IF EXISTS bigso_sso;');
    console.log('🗑️  Dropped database bigso_sso');

    await client.query('CREATE DATABASE bigso_sso;');
    console.log('✅ Created database bigso_sso');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

dropAndRecreateDB();
