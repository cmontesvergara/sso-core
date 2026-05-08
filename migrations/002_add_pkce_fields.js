/* eslint-disable no-unused-vars */

/**
 * Migration 002: Add PKCE fields to auth_codes
 *
 * Adds optional columns for SSO v2.3 PKCE support:
 * - code_challenge: S256 hash of the verifier
 * - code_challenge_method: 'S256' or 'plain'
 * - state: anti-CSRF token
 * - nonce: replay protection
 *
 * All fields are nullable for backward compatibility with v1.0 flow.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('auth_codes', {
    code_challenge: {
      type: 'varchar(128)',
      notNull: false,
      comment: 'PKCE code challenge (S256 hash of verifier)',
    },
    code_challenge_method: {
      type: 'varchar(10)',
      notNull: false,
      comment: 'PKCE method: S256 or plain',
    },
    state: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Anti-CSRF state parameter',
    },
    nonce: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Replay protection nonce',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('auth_codes', [
    'code_challenge',
    'code_challenge_method',
    'state',
    'nonce',
  ]);
};
