/* eslint-disable no-unused-vars */

/**
 * Migration 005: Add updated_at Column
 * 
 * This migration adds the updated_at column to the users table
 * to track when user records are modified
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Create a trigger to automatically update updated_at
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  pgm.sql(`
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column;');
  pgm.dropColumns('users', ['updated_at']);
};
