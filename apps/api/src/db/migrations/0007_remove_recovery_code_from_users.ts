import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth.users')
    .dropColumn('recovery_code')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth.users')
    .addColumn('recovery_code', sql`bytea`)
    .execute()
} 