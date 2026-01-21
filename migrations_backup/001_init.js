/* Create 001_init migration - baseline schema with RLS policies
 * This migration sets up core tables and row-level security for multi-tenant architecture
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create pgcrypto extension for UUID generation
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create users table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    first_name: { type: 'text' },
    last_name: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Create refresh_tokens table
  pgm.createTable('refresh_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)', onDelete: 'cascade' },
    token_hash: { type: 'text', notNull: true, unique: true },
    client_id: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked: { type: 'boolean', notNull: true, default: false },
    previous_token_id: { type: 'uuid' },
    ip: { type: 'text' },
    user_agent: { type: 'text' },
  });
  pgm.createIndex('refresh_tokens', 'token_hash');
  pgm.createIndex('refresh_tokens', 'user_id');

  // Create tenants table for multi-tenancy
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true, unique: true },
    slug: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Create tenant_members junction table (many-to-many users-tenants)
  pgm.createTable('tenant_members', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"(id)', onDelete: 'cascade' },
    user_id: { type: 'uuid', notNull: true, references: '"users"(id)', onDelete: 'cascade' },
    role: { type: 'text', notNull: true, default: 'member' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('tenant_members', ['tenant_id', 'user_id'], { unique: true });
  pgm.createIndex('tenant_members', 'tenant_id');
  pgm.createIndex('tenant_members', 'user_id');

  // Create roles table (tenant-scoped roles)
  pgm.createTable('roles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: '"tenants"(id)', onDelete: 'cascade' },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('roles', ['tenant_id', 'name'], { unique: true });
  pgm.createIndex('roles', 'tenant_id');

  // Create permissions table
  pgm.createTable('permissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    role_id: { type: 'uuid', notNull: true, references: '"roles"(id)', onDelete: 'cascade' },
    resource: { type: 'text', notNull: true },
    action: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('permissions', ['role_id', 'resource', 'action'], { unique: true });
  pgm.createIndex('permissions', 'role_id');

  // Enable RLS on core tables
  pgm.sql('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE roles ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE permissions ENABLE ROW LEVEL SECURITY');

  // RLS Policies: users can only see their own user record
  pgm.sql(`
    CREATE POLICY users_own_record ON users
    USING (id = current_setting('app.current_user_id')::uuid)
    WITH CHECK (id = current_setting('app.current_user_id')::uuid)
  `);

  // RLS Policies: users can only see refresh tokens they own
  pgm.sql(`
    CREATE POLICY refresh_tokens_own ON refresh_tokens
    USING (user_id = current_setting('app.current_user_id')::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id')::uuid)
  `);

  // RLS Policies: users can only see tenants they are a member of
  pgm.sql(`
    CREATE POLICY tenants_member_access ON tenants
    USING (EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenants.id
      AND tenant_members.user_id = current_setting('app.current_user_id')::uuid
    ))
  `);

  // RLS Policies: tenant_members visible only to members of that tenant
  pgm.sql(`
    CREATE POLICY tenant_members_visibility ON tenant_members
    USING (tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    ))
  `);

  // RLS Policies: roles visible to tenant members
  pgm.sql(`
    CREATE POLICY roles_tenant_access ON roles
    USING (tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    ))
  `);

  // RLS Policies: permissions visible to tenant members (through roles)
  pgm.sql(`
    CREATE POLICY permissions_tenant_access ON permissions
    USING (role_id IN (
      SELECT roles.id FROM roles
      WHERE roles.tenant_id IN (
        SELECT tenant_id FROM tenant_members
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    ))
  `);
};

exports.down = (pgm) => {
  // Drop RLS policies
  pgm.sql('DROP POLICY IF EXISTS users_own_record ON users');
  pgm.sql('DROP POLICY IF EXISTS refresh_tokens_own ON refresh_tokens');
  pgm.sql('DROP POLICY IF EXISTS tenants_member_access ON tenants');
  pgm.sql('DROP POLICY IF EXISTS tenant_members_visibility ON tenant_members');
  pgm.sql('DROP POLICY IF EXISTS roles_tenant_access ON roles');
  pgm.sql('DROP POLICY IF EXISTS permissions_tenant_access ON permissions');

  // Disable RLS
  pgm.sql('ALTER TABLE users DISABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenants DISABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tenant_members DISABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE roles DISABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE permissions DISABLE ROW LEVEL SECURITY');

  // Drop tables in reverse order
  pgm.dropTable('permissions');
  pgm.dropTable('roles');
  pgm.dropTable('tenant_members');
  pgm.dropTable('tenants');
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('users');

  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"');
  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto');
};
