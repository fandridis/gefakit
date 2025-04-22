// Example Migration Snippet (adjust table/column names)
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth.users')
    .addColumn('role', 'varchar(64)', (col) => col.notNull().defaultTo('USER'))
    .execute();
  // Optionally add an index
  await db.schema.createIndex('users_role_idx').on('auth.users').column('role').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('users_role_idx').on('auth.users').execute();
  await db.schema.alterTable('auth.users').dropColumn('role').execute();
}
