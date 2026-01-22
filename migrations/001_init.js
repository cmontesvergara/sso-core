/* eslint-disable no-unused-vars */

/**
 * Migration 001: Complete Initial Schema
 *
 * Creates all tables aligned with Prisma schema including:
 * - Users with all extended fields
 * - Addresses
 * - Other Information
 * - Refresh Tokens
 * - Tenants and Multi-tenancy
 * - Roles and Permissions
 * - OTP Secrets
 * - Email Verifications
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create extensions
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ============================================================
  // USERS TABLE - Complete with all fields
  // ============================================================
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },

    // Basic Information
    first_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    second_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    last_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    second_last_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    phone: {
      type: 'varchar(20)',
      notNull: true,
    },
    nuid: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },

    // Additional Information
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
    user_status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'active',
    },

    // Recovery Information
    recovery_phone: {
      type: 'varchar(20)',
      notNull: false,
    },
    recovery_email: {
      type: 'varchar(255)',
      notNull: false,
    },

    // Timestamps
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

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'nuid');
  pgm.createIndex('users', 'user_status');

  // ============================================================
  // ADDRESSES TABLE
  // ============================================================
  pgm.createTable('addresses', {
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
    country: {
      type: 'varchar(255)',
      notNull: true,
    },
    province: {
      type: 'varchar(255)',
      notNull: true,
    },
    city: {
      type: 'varchar(255)',
      notNull: true,
    },
    detail: {
      type: 'text',
      notNull: true,
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

  pgm.createIndex('addresses', 'user_id');

  // ============================================================
  // OTHER INFORMATION TABLE
  // ============================================================
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
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    data: {
      type: 'jsonb',
      notNull: false,
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

  // ============================================================
  // REFRESH TOKENS TABLE
  // ============================================================
  pgm.createTable('refresh_tokens', {
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
    token_hash: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    client_id: {
      type: 'text',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    revoked: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    previous_token_id: {
      type: 'uuid',
      notNull: false,
    },
    ip: {
      type: 'text',
      notNull: false,
    },
    user_agent: {
      type: 'text',
      notNull: false,
    },
  });

  pgm.createIndex('refresh_tokens', 'token_hash');
  pgm.createIndex('refresh_tokens', 'user_id');

  // ============================================================
  // TENANTS TABLE
  // ============================================================
  pgm.createTable('tenants', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    slug: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // ============================================================
  // TENANT MEMBERS TABLE
  // ============================================================
  pgm.createTable('tenant_members', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: '"tenants"(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('tenant_members', ['tenant_id', 'user_id'], { unique: true });
  pgm.createIndex('tenant_members', 'tenant_id');
  pgm.createIndex('tenant_members', 'user_id');

  // ============================================================
  // ROLES TABLE
  // ============================================================
  pgm.createTable('roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: '"tenants"(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('roles', ['tenant_id', 'name'], { unique: true });
  pgm.createIndex('roles', 'tenant_id');

  // ============================================================
  // PERMISSIONS TABLE
  // ============================================================
  pgm.createTable('permissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    role_id: {
      type: 'uuid',
      notNull: true,
      references: '"roles"(id)',
      onDelete: 'CASCADE',
    },
    resource: {
      type: 'text',
      notNull: true,
    },
    action: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('permissions', ['role_id', 'resource', 'action'], { unique: true });
  pgm.createIndex('permissions', 'role_id');

  // ============================================================
  // OTP SECRETS TABLE
  // ============================================================
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
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // ============================================================
  // EMAIL VERIFICATIONS TABLE
  // ============================================================
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
      type: 'varchar(255)',
      notNull: true,
    },
    verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('email_verifications', 'user_id');
  pgm.createIndex('email_verifications', 'token');

  // ============================================================
  // TRIGGERS
  // ============================================================

  // Trigger to auto-update updated_at on users table
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
    CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `);

  pgm.sql(`
    CREATE TRIGGER update_other_information_updated_at 
    BEFORE UPDATE ON other_information
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `);

  // ============================================================
  // ROW LEVEL SECURITY (RLS)
  // ============================================================

  pgm.sql('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE roles ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE permissions ENABLE ROW LEVEL SECURITY');

  // RLS Policy: users can only see their own user record
  pgm.sql(`
    CREATE POLICY users_own_record ON users
    USING (id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_user_id', true)::uuid)
  `);

  // RLS Policy: users can only see refresh tokens they own
  pgm.sql(`
    CREATE POLICY refresh_tokens_own ON refresh_tokens
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
  `);

  // RLS Policy: users can only see tenants they are members of
  pgm.sql(`
    CREATE POLICY tenant_members_policy ON tenants
    USING (
      id IN (
        SELECT tenant_id FROM tenant_members 
        WHERE user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  `);

  // RLS Policy: tenant_members can see other members in their tenants
  pgm.sql(`
    CREATE POLICY tenant_members_own ON tenant_members
    USING (
      tenant_id IN (
        SELECT tenant_id FROM tenant_members 
        WHERE user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  `);

  // RLS Policy: roles scoped to user's tenants
  pgm.sql(`
    CREATE POLICY roles_tenant_scoped ON roles
    USING (
      tenant_id IN (
        SELECT tenant_id FROM tenant_members 
        WHERE user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  `);

  // RLS Policy: permissions scoped to roles in user's tenants
  pgm.sql(`
    CREATE POLICY permissions_tenant_scoped ON permissions
    USING (
      role_id IN (
        SELECT r.id FROM roles r
        INNER JOIN tenant_members tm ON r.tenant_id = tm.tenant_id
        WHERE tm.user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  `);
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign keys)
  pgm.dropTable('email_verifications');
  pgm.dropTable('otp_secrets');
  pgm.dropTable('permissions');
  pgm.dropTable('roles');
  pgm.dropTable('tenant_members');
  pgm.dropTable('tenants');
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('other_information');
  pgm.dropTable('addresses');
  pgm.dropTable('users');

  // Drop functions
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column');

  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"');
  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto');
};
