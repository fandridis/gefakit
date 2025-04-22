import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
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

  // Add unique constraint to prevent linking the same provider account multiple times
  await db.schema
    .createIndex('oauth_accounts_provider_provider_user_id_unique_idx')
    .on('auth.oauth_accounts')
    .columns(['provider', 'provider_user_id'])
    .unique()
    .execute();
    
  // Index for faster lookups by user_id
  await db.schema
    .createIndex('oauth_accounts_user_id_idx')
    .on('auth.oauth_accounts')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('oauth_accounts_user_id_idx').ifExists().execute();
  await db.schema.dropIndex('oauth_accounts_provider_provider_user_id_unique_idx').ifExists().execute();
  await db.schema.dropTable('auth.oauth_accounts').ifExists().execute();
} 