import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth.sessions')
    .addColumn('impersonator_user_id', 'integer', (col) =>
       col.references('auth.users.id').onDelete('set null')
    )
    .execute();

   await db.schema.createIndex('sessions_impersonator_user_id_idx').on('auth.sessions').column('impersonator_user_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('sessions_impersonator_user_id_idx').execute();

  await db.schema
    .alterTable('auth.sessions')
    .dropColumn('impersonator_user_id')
    .execute();
}