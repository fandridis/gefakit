import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add is_default to organizations.memberships
  await db.schema
    .alterTable('organizations.memberships')
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Add a unique index to ensure only one default membership per user
  // This is a common pattern in PostgreSQL. Adjust if using a different DB.
  // We use a partial index where is_default is true.
  await db.schema
    .createIndex('memberships_user_id_is_default_unique_idx')
    .on('organizations.memberships')
    .column('user_id')
    .where(sql<boolean>`is_default = true`) // Explicitly type the raw SQL result
    .unique()
    .execute();

  // Add active_organization_id to auth.sessions
  await db.schema
    .alterTable('auth.sessions')
    .addColumn('active_organization_id', 'integer', (col) =>
      col
        .references('organizations.organizations.id')
        .onDelete('set null') // If the referenced organization is deleted, set this field to NULL
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove active_organization_id from auth.sessions
  // The foreign key constraint is dropped automatically when the column is dropped in most systems.
  await db.schema.alterTable('auth.sessions').dropColumn('active_organization_id').execute();

  // Remove the unique index from organizations.memberships
  await db.schema.dropIndex('memberships_user_id_is_default_unique_idx').ifExists().execute();

  // Remove is_default from organizations.memberships
  await db.schema.alterTable('organizations.memberships').dropColumn('is_default').execute();
}