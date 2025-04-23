import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('auth.otp_codes')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => 
      col.references('auth.users.id').onDelete('cascade').notNull()
    )
    .addColumn('hashed_code', 'text', (col) => col.notNull()) // Store hashed OTP
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => 
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Index for faster lookups by user_id
  await db.schema
    .createIndex('idx_otp_codes_user_id')
    .on('auth.otp_codes')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_otp_codes_user_id')
    .ifExists()
    .execute();

  await db.schema
    .dropTable('auth.otp_codes')
    .ifExists()
    .execute();
} 