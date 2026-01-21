/* eslint-disable no-unused-vars */

/**
 * Migration 004: Add User Status Column
 * 
 * This migration adds the user_status column to the users table
 * to track the status of user accounts (active, inactive, suspended, etc.)
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    user_status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'active',
    },
  });

  // Create an index on user_status for better query performance
  pgm.createIndex('users', 'user_status');
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'user_status');
  pgm.dropColumns('users', ['user_status']);
};
