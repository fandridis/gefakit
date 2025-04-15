import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Alter the existing app_user table to add new columns
  await db.schema
    .alterTable('app_user')
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('recovery_code', 'bytea')
    .addColumn('created_at', 'timestamptz', (col) => 
      col.defaultTo(sql`now()`).notNull())
    .execute()

  // No need to recreate user_session table as it already exists from the first migration
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove the columns added in this migration
  await db.schema
    .alterTable('app_user')
    .dropColumn('email')
    .dropColumn('password_hash')
    .dropColumn('recovery_code')
    .dropColumn('created_at')
    .execute()
}

