/* eslint-disable no-unused-vars */

/**
 * Migration 003: Add Extended User Fields
 * 
 * This migration extends the User model with additional fields to support
 * the complete user interface specification from user.interface.ts
 * 
 * Changes:
 * - Adds 14 new columns to users table
 * - Creates addresses table for 1-to-many address relationships
 * - Creates other_information table for flexible JSON data storage
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Step 1: Add new columns to users table
  pgm.addColumns('users', {
    second_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    nuid: {
      type: 'varchar(255)',
      notNull: false,
      unique: true,
    },
    birth_date: {
      type: 'date',
      notNull: false,
    },
    gender: {
      type: 'varchar(50)',
      notNull: false,
    },
    nationality: {
      type: 'varchar(100)',
      notNull: false,
    },
    place_of_birth: {
      type: 'varchar(255)',
      notNull: false,
    },
    place_of_residence: {
      type: 'varchar(255)',
      notNull: false,
    },
    occupation: {
      type: 'varchar(255)',
      notNull: false,
    },
    marital_status: {
      type: 'varchar(50)',
      notNull: false,
    },
    recovery_phone: {
      type: 'varchar(20)',
      notNull: false,
    },
    recovery_email: {
      type: 'varchar(255)',
      notNull: false,
    },
    phone: {
      type: 'varchar(20)',
      notNull: false,
    },
    second_last_name: {
      type: 'varchar(255)',
      notNull: false,
    },
  });

  // Step 2: Create addresses table
  pgm.createTable('addresses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    country: {
      type: 'varchar(255)',
      notNull: true,
    },
    state: {
      type: 'varchar(255)',
      notNull: true,
    },
    city: {
      type: 'varchar(255)',
      notNull: true,
    },
    street: {
      type: 'varchar(255)',
      notNull: false,
    },
    postal_code: {
      type: 'varchar(20)',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Create index on user_id for faster queries
  pgm.createIndex('addresses', 'user_id');

  // Step 3: Create other_information table
  pgm.createTable('other_information', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    data: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
    },
    scope: {
      type: 'text[]',
      notNull: true,
      default: '{}',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order
  pgm.dropTable('other_information', { ifExists: true });
  pgm.dropTable('addresses', { ifExists: true });

  // Remove columns from users table
  pgm.dropColumns('users', [
    'second_name',
    'nuid',
    'birth_date',
    'gender',
    'nationality',
    'place_of_birth',
    'place_of_residence',
    'occupation',
    'marital_status',
    'recovery_phone',
    'recovery_email',
    'phone',
    'second_last_name',
  ]);
};
