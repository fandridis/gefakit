// import { Kysely, sql } from 'kysely'

// export async function up(db: Kysely<any>): Promise<void> {
//   await db.schema
//     .createTable('person')
//     .addColumn('id', 'serial', (col) => col.primaryKey())
//     .addColumn('first_name', 'varchar', (col) => col.notNull())
//     .addColumn('last_name', 'varchar')
//     .addColumn('gender', 'varchar(50)', (col) => col.notNull())
//     .addColumn('created_at', 'timestamp', (col) =>
//       col.defaultTo(sql`now()`).notNull(),
//     )
//     .execute()

//   await db.schema
//     .createTable('pet')
//     .addColumn('id', 'serial', (col) => col.primaryKey())
//     .addColumn('name', 'varchar', (col) => col.notNull().unique())
//     .addColumn('owner_id', 'integer', (col) =>
//       col.references('person.id').onDelete('cascade').notNull(),
//     )
//     .addColumn('species', 'varchar', (col) => col.notNull())
//     .execute()

//   await db.schema
//     .createIndex('pet_owner_id_index')
//     .on('pet')
//     .column('owner_id')
//     .execute()
// }

// export async function down(db: Kysely<any>): Promise<void> {
//   await db.schema.dropTable('pet').execute()
//   await db.schema.dropTable('person').execute()
// }

/**
 * CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE user_session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(id),
    expires_at TIMESTAMPTZ NOT NULL,
);
 */

import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('app_user')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .execute()

  await db.schema
    .createTable('user_session')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('app_user.id').notNull()
    )
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_session').execute()
  await db.schema.dropTable('app_user').execute()
}
