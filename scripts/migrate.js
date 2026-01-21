#!/usr/bin/env node

/**
 * Load .env and run node-pg-migrate with DATABASE_URL constructed
 * from individual database config variables
 */

const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Load .env file
dotenv.config();

// Build DATABASE_URL from .env variables
const {
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_PASSWORD,
} = process.env;

if (!DATABASE_HOST || !DATABASE_PORT || !DATABASE_NAME || !DATABASE_USER || !DATABASE_PASSWORD) {
  console.error('❌ Missing database configuration in .env file');
  console.error('Required variables: DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD');
  process.exit(1);
}

const DATABASE_URL = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

// Get command arguments (up, down, create, etc.)
const args = process.argv.slice(2).join(' ');

try {
  console.log(`🔄 Running migration: ${args}`);
  console.log(`📍 Database: ${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`);
  
  execSync(`npx node-pg-migrate ${args}`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL }
  });
  
  console.log('✅ Migration completed');
} catch (error) {
  console.error('❌ Migration failed');
  process.exit(1);
}
