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
      WHERE pg_stat_activity.datname = 'supertoken'
        AND pid <> pg_backend_pid();
    `);
    console.log('👥 Disconnected all users from supertoken');

    await client.query('DROP DATABASE IF EXISTS supertoken;');
    console.log('🗑️  Dropped database supertoken');

    await client.query('CREATE DATABASE supertoken;');
    console.log('✅ Created database supertoken');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

dropAndRecreateDB();
