import { Insertable, Kysely, Updateable, Transaction } from "kysely";
import { CoreSubscription, DB } from "../../db/db-types";


export type PaymentRepository = ReturnType<typeof createPaymentRepository>

export function createPaymentRepository({ db }: { db: Kysely<DB> | Transaction<DB> }) {
    return {
        async findSubscriptionByUserId({ userId }: { userId: number }) {
            return db
                .selectFrom('core.subscriptions')
                .selectAll()
                .where('user_id', '=', userId)
                .executeTakeFirst();
        },

        async findSubscriptionByOrganizationId({ organizationId }: { organizationId: number }) {
            return db
                .selectFrom('core.subscriptions')
                .selectAll()
                .where('organization_id', '=', organizationId)
                .executeTakeFirst();
        },

        async findSubscriptionByStripeSubscriptionId({ stripeSubscriptionId }: { stripeSubscriptionId: string }) {
            return db
                .selectFrom('core.subscriptions')
                .selectAll()
                .where('stripe_subscription_id', '=', stripeSubscriptionId)
                .executeTakeFirst();
        },

        async createSubscription({ subscription }: { subscription: Insertable<CoreSubscription> }) {
            return db
                .insertInto('core.subscriptions')
                .values({ ...subscription })
                .returningAll()
                .executeTakeFirstOrThrow();
        },

        async updateSubscription({ id, subscription }: { id: number, subscription: Updateable<CoreSubscription> }) {
            return db
                .updateTable('core.subscriptions')
                .set(subscription)
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow()
        },

        async deleteSubscription({ id }: { id: number }) {
            return db
                .deleteFrom('core.subscriptions')
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow();
        },
    };
}
