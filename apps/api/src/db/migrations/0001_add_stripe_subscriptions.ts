import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add stripe_customer_id to auth.users
    await db.schema
        .alterTable('auth.users')
        .addColumn('stripe_customer_id', 'text', (col) => col.unique())
        .execute();

    // Add stripe_customer_id to organizations.organizations
    await db.schema
        .alterTable('organizations.organizations')
        .addColumn('stripe_customer_id', 'text', (col) => col.unique())
        .execute();

    // Create subscriptions table
    await db.schema
        .createTable('core.subscriptions')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('stripe_subscription_id', 'text', (col) => col.notNull().unique())
        .addColumn('user_id', 'integer', (col) =>
            col.references('auth.users.id').onDelete('cascade')
        )
        .addColumn('organization_id', 'integer', (col) =>
            col.references('organizations.organizations.id').onDelete('cascade')
        )
        .addColumn('stripe_customer_id', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) => col.notNull())
        .addColumn('stripe_price_id', 'text', (col) => col.notNull())
        .addColumn('current_period_start', 'timestamptz', (col) => col.notNull())
        .addColumn('current_period_end', 'timestamptz', (col) => col.notNull())
        .addColumn('cancel_at_period_end', 'boolean', (col) => col.notNull().defaultTo(false))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .execute();

    // Add check constraint for subscription owner
    await sql`
    ALTER TABLE core.subscriptions
    ADD CONSTRAINT check_subscription_owner
    CHECK ((user_id IS NOT NULL AND organization_id IS NULL) OR
           (user_id IS NULL AND organization_id IS NOT NULL));
  `.execute(db);

    // Create indexes
    await db.schema
        .createIndex('subscriptions_stripe_subscription_id_idx')
        .on('core.subscriptions')
        .column('stripe_subscription_id')
        .execute();

    await db.schema
        .createIndex('subscriptions_stripe_customer_id_idx')
        .on('core.subscriptions')
        .column('stripe_customer_id')
        .execute();

    await db.schema
        .createIndex('subscriptions_user_id_idx')
        .on('core.subscriptions')
        .column('user_id')
        .execute();

    await db.schema
        .createIndex('subscriptions_organization_id_idx')
        .on('core.subscriptions')
        .column('organization_id')
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop indexes
    await db.schema.dropIndex('subscriptions_organization_id_idx').ifExists().execute();
    await db.schema.dropIndex('subscriptions_user_id_idx').ifExists().execute();
    await db.schema.dropIndex('subscriptions_stripe_customer_id_idx').ifExists().execute();
    await db.schema.dropIndex('subscriptions_stripe_subscription_id_idx').ifExists().execute();

    // Drop subscriptions table
    await db.schema.dropTable('core.subscriptions').ifExists().execute();

    // Remove stripe_customer_id from organizations.organizations
    await db.schema
        .alterTable('organizations.organizations')
        .dropColumn('stripe_customer_id')
        .execute();

    // Remove stripe_customer_id from auth.users
    await db.schema
        .alterTable('auth.users')
        .dropColumn('stripe_customer_id')
        .execute();
} 