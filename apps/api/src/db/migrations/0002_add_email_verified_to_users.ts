import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth.users')
    .addColumn('email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Note: In SQLite, dropping columns is not directly supported.
  // You might need a more complex migration strategy for SQLite.
  await db.schema.alterTable('auth.users').dropColumn('email_verified').execute()
} 