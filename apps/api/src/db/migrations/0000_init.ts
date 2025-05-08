import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // --- Schemas ---
  await db.schema.createSchema('auth').ifNotExists().execute();
  await db.schema.createSchema('core').ifNotExists().execute();
  await db.schema.createSchema('organizations').ifNotExists().execute();

  // --- Custom Types ---
  await db.schema
    .createType('organizations.membership_role')
    .asEnum(['owner', 'admin', 'member'])
    .execute();

  await db.schema
    .createType('organizations.invitation_status')
    .asEnum(['pending', 'accepted', 'declined', 'expired'])
    .execute();

  // --- Tables ---

  // auth.users
  await db.schema
    .createTable('auth.users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('role', 'varchar(64)', (col) => col.notNull().defaultTo('USER'))
    .execute();

  // organizations.organizations
  await db.schema
    .createTable('organizations.organizations')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // auth.sessions
  await db.schema
    .createTable('auth.sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('active_organization_id', 'integer', (col) =>
      col.references('organizations.organizations.id').onDelete('set null')
    )
    .addColumn('impersonator_user_id', 'integer', (col) =>
      col.references('auth.users.id').onDelete('set null')
    )
    .execute();

  // organizations.memberships
  await db.schema
    .createTable('organizations.memberships')
    .addColumn('user_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('organization_id', 'integer', (col) => col.references('organizations.organizations.id').onDelete('cascade').notNull())
    .addColumn('role', sql`organizations.membership_role`, (col) => col.notNull())
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('memberships_pkey', ['user_id', 'organization_id'])
    .execute();

  // organizations.invitations
  await db.schema
    .createTable('organizations.invitations')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('organization_id', 'integer', (col) => col.references('organizations.organizations.id').onDelete('cascade').notNull())
    .addColumn('invited_by_user_id', 'integer', (col) => col.references('auth.users.id').onDelete('set null'))
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('role', sql`organizations.membership_role`, (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('status', sql`organizations.invitation_status`, (col) => col.notNull().defaultTo('pending'))
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // auth.email_verifications
  await db.schema
    .createTable('auth.email_verifications')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // core.todos
  await db.schema
    .createTable('core.todos')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar')
    .addColumn('due_date', 'timestamp')
    .addColumn('completed', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('author_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // core.notifications
  await db.schema
    .createTable('core.notifications')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('auth.users.id').onDelete('cascade').notNull()
    )
    .addColumn('type', 'varchar(64)', (col) => col.notNull())
    .addColumn('template_key', 'varchar(255)', (col) => col.notNull())
    .addColumn('template_variables', 'jsonb')
    .addColumn('action_url', 'text')
    .addColumn('read_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('expires_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('auth.oauth_accounts')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('auth.users.id').onDelete('cascade').notNull()
    )
    .addColumn('provider', 'varchar(64)', (col) => col.notNull()) // e.g., 'github', 'google'
    .addColumn('provider_user_id', 'text', (col) => col.notNull()) // User ID from the OAuth provider
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('auth.password_reset_tokens')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('auth.users.id').onDelete('cascade').notNull()
    )
    .addColumn('hashed_token', 'text', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createTable('auth.otp_codes')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('auth.users.id').onDelete('cascade').notNull()
    )
    .addColumn('hashed_code', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // --- Indexes ---
  await db.schema
    .createIndex('invitations_token_idx')
    .on('organizations.invitations')
    .column('token')
    .execute();

  await db.schema
    .createIndex('email_verifications_identifier_idx')
    .on('auth.email_verifications')
    .column('identifier')
    .execute();

  await db.schema
    .createIndex('memberships_user_id_is_default_unique_idx')
    .on('organizations.memberships')
    .column('user_id')
    .where(sql<boolean>`is_default = true`)
    .unique()
    .execute();

  await db.schema
    .createIndex('users_role_idx')
    .on('auth.users')
    .column('role')
    .execute();

  await db.schema
    .createIndex('sessions_impersonator_user_id_idx')
    .on('auth.sessions')
    .column('impersonator_user_id')
    .execute();

  await db.schema
    .createIndex('oauth_accounts_provider_provider_user_id_unique_idx')
    .on('auth.oauth_accounts')
    .columns(['provider', 'provider_user_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('oauth_accounts_user_id_idx')
    .on('auth.oauth_accounts')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_password_reset_tokens_user_id')
    .on('auth.password_reset_tokens')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_otp_codes_user_id')
    .on('auth.otp_codes')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_notifications_user_created')
    .on('core.notifications')
    .columns(['user_id', 'created_at desc'])
    .execute();

  await sql`
    CREATE INDEX idx_notifications_user_unread_ordered
    ON core.notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;
  `.execute(db);
}

//  The down function drops all tables, types, schemas, and indexes in reverse order of creation.
export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_notifications_user_unread_ordered;`.execute(db);
  await db.schema.dropIndex('idx_notifications_user_created').ifExists().execute();
  await db.schema.dropIndex('idx_otp_codes_user_id').ifExists().execute();
  await db.schema.dropIndex('idx_password_reset_tokens_user_id').ifExists().execute();
  await db.schema.dropIndex('oauth_accounts_user_id_idx').ifExists().execute();
  await db.schema.dropIndex('oauth_accounts_provider_provider_user_id_unique_idx').ifExists().execute();
  await db.schema.dropIndex('sessions_impersonator_user_id_idx').ifExists().execute();
  await db.schema.dropIndex('users_role_idx').ifExists().execute();
  await db.schema.dropIndex('memberships_user_id_is_default_unique_idx').ifExists().execute();
  await db.schema.dropIndex('email_verifications_identifier_idx').ifExists().execute();
  await db.schema.dropIndex('invitations_token_idx').ifExists().execute();

  await db.schema.dropTable('auth.otp_codes').ifExists().execute();
  await db.schema.dropTable('auth.password_reset_tokens').ifExists().execute();
  await db.schema.dropTable('auth.oauth_accounts').ifExists().execute();
  await db.schema.dropTable('core.notifications').ifExists().execute();
  await db.schema.dropTable('core.todos').ifExists().execute();
  await db.schema.dropTable('auth.email_verifications').ifExists().execute();
  await db.schema.dropTable('organizations.invitations').ifExists().execute();
  await db.schema.dropTable('organizations.memberships').ifExists().execute();
  await db.schema.dropTable('organizations.organizations').ifExists().execute();
  await db.schema.dropTable('auth.sessions').ifExists().execute();
  await db.schema.dropTable('auth.users').ifExists().execute();

  await db.schema.dropType('organizations.invitation_status').ifExists().execute();
  await db.schema.dropType('organizations.membership_role').ifExists().execute();

  await db.schema.dropSchema('organizations').ifExists().execute();
  await db.schema.dropSchema('core').ifExists().execute();
  await db.schema.dropSchema('auth').ifExists().execute();
}
