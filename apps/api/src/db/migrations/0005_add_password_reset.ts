import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
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
    .createIndex('idx_password_reset_tokens_user_id')
    .on('auth.password_reset_tokens')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_password_reset_tokens_user_id')
    .ifExists()
    .execute();

  await db.schema
    .dropTable('auth.password_reset_tokens')
    .ifExists()
    .execute();
} 