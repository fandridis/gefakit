import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create schemas
  await db.schema.createSchema('auth').ifNotExists().execute()
  await db.schema.createSchema('core').ifNotExists().execute()
  await db.schema.createSchema('organizations').ifNotExists().execute()

  // Create custom types
  await db.schema
    .createType('organizations.membership_role')
    .asEnum(['owner', 'admin', 'member'])
    .execute()

  await db.schema
    .createType('organizations.invitation_status')
    .asEnum(['pending', 'accepted', 'declined', 'expired'])
    .execute()

  // Create auth.users table
  await db.schema
    .createTable('auth.users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('recovery_code', sql`bytea`) // Kysely might not have native bytea support
    .addColumn('created_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create auth.sessions table
  await db.schema
    .createTable('auth.sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .execute()

  // Create organizations.organizations table
  await db.schema
    .createTable('organizations.organizations')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create organizations.memberships table
  await db.schema
    .createTable('organizations.memberships')
    .addColumn('user_id', 'integer', (col) =>col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('organization_id', 'integer', (col) => col.references('organizations.organizations.id').onDelete('cascade').notNull())
    .addColumn('role', sql`organizations.membership_role`, (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('memberships_pkey', ['user_id', 'organization_id'])
    .execute()

  // Create organizations.invitations table
  await db.schema
    .createTable('organizations.invitations')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('organization_id', 'integer', (col) =>col.references('organizations.organizations.id').onDelete('cascade').notNull())
    .addColumn('invited_by_user_id', 'integer', (col) =>col.references('auth.users.id').onDelete('set null'))
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('role', sql`organizations.membership_role`, (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('status', sql`organizations.invitation_status`, (col) =>col.notNull().defaultTo('pending'))
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create index on organizations.invitations(token)
  await db.schema
    .createIndex('invitations_token_idx')
    .on('organizations.invitations')
    .column('token')
    .execute()

  // Create core.todos table
  await db.schema
    .createTable('core.todos')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar')
    .addColumn('due_date', 'timestamp')
    .addColumn('completed', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('author_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order of creation
  await db.schema.dropTable('core.todos').ifExists().execute()
  await db.schema.dropIndex('invitations_token_idx').ifExists().execute()
  await db.schema.dropTable('organizations.invitations').ifExists().execute()
  await db.schema.dropTable('organizations.memberships').ifExists().execute()
  await db.schema.dropTable('organizations.organizations').ifExists().execute()
  await db.schema.dropTable('auth.sessions').ifExists().execute()
  await db.schema.dropTable('auth.users').ifExists().execute()

  // Drop custom types
  await db.schema.dropType('organizations.invitation_status').ifExists().execute()
  await db.schema.dropType('organizations.membership_role').ifExists().execute()

  // Drop schemas
  await db.schema.dropSchema('organizations').ifExists().execute()
  await db.schema.dropSchema('core').ifExists().execute()
  await db.schema.dropSchema('auth').ifExists().execute()
} 