/* eslint-disable */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create OTP Secrets table
  pgm.createTable('otp_secrets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    secret: {
      type: 'text',
      notNull: true,
    },
    verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    backup_codes: {
      type: 'text[]',
      notNull: true,
      default: '{}',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('otp_secrets', 'user_id');

  // Create Email Verification table
  pgm.createTable('email_verifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    email: {
      type: 'text',
      notNull: true,
    },
    verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('email_verifications', 'user_id');
  pgm.createIndex('email_verifications', 'token');

  // Enable RLS on new tables
  pgm.sql('ALTER TABLE otp_secrets ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;');

  // RLS Policies for otp_secrets
  pgm.sql(`
    CREATE POLICY otp_secrets_own_record ON otp_secrets
      FOR ALL
      USING (user_id = current_setting('app.current_user_id')::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
  `);

  // RLS Policies for email_verifications
  pgm.sql(`
    CREATE POLICY email_verifications_own_record ON email_verifications
      FOR ALL
      USING (user_id = current_setting('app.current_user_id')::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('email_verifications', { ifExists: true });
  pgm.dropTable('otp_secrets', { ifExists: true });
};
