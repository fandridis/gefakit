import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('auth.email_verifications')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.references('auth.users.id').onDelete('cascade').notNull())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Add index on identifier for faster lookups
  await db.schema
    .createIndex('email_verifications_identifier_idx')
    .on('auth.email_verifications')
    .column('identifier')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('email_verifications_identifier_idx').ifExists().execute()
  await db.schema.dropTable('auth.email_verifications').ifExists().execute()
} 