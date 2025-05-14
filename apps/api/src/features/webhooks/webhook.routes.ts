import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { Stripe } from "stripe";
import { HTTPException } from "hono/http-exception";
import { AppVariables } from "../../create-app";
import { getOrganizationService, getPaymentService, getUserService } from "../../utils/get-service";

// Stripe sends at least the following properties in addition to the Subscription object.
interface ExtendedSubscription extends Stripe.Subscription {
    plan: { id: string };
    quantity: number;
}

type StripeWebhookAppVariables = AppVariables & {
    stripe: Stripe;
}

export function createWebhookRoutes() {
    const app = new Hono<{ Bindings: Bindings; Variables: StripeWebhookAppVariables }>();

    app.post('/stripe', async (c) => { // Path will be /webhooks/stripe
        console.log(' /\\_/\\                          /\\_/\\');
        console.log('( ^.^ )   At /webhooks/stripe   ( ^.^ )');
        console.log(' / | | \\\\                        / | | \\\\');
        console.log('( u u )                        ( u u )');
        const STRIPE_WEBHOOK_SECRET = c.env.STRIPE_WEBHOOK_SECRET;

        const stripe = c.get('stripe');

        if (!stripe) {
            throw new HTTPException(500, { message: 'Stripe not initialized' });
        }

        const signature = c.req.header('stripe-signature');
        try {
            if (!signature) {
                return c.text('Missing signature', 400);
            }
            const body = await c.req.text();
            const event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                STRIPE_WEBHOOK_SECRET
            );
            switch (event.type) {
                case 'customer.subscription.created': {
                    console.log('============== customer.subscription.created via /webhooks/stripe ==============');
                    console.log(' ');

                    const stripeSubscription = event.data.object
                    const stripeSubscriptionItem = event.data.object.items.data[0]

                    console.log('====== stripeSubscription: ======');
                    console.log(stripeSubscription);
                    console.log('===== END OF stripeSubscription ======');

                    console.log('====== stripeSubscriptionItem: ======');
                    console.log(stripeSubscriptionItem);
                    console.log('===== END OF stripeSubscriptionItem ======');

                    console.log('====== metadata: ======');
                    console.log(stripeSubscription.metadata);
                    console.log('===== END OF metadata ======');


                    const mappedData = {
                        stripe_subscription_id: stripeSubscriptionItem.id,
                        stripe_customer_id: stripeSubscription.customer as string,
                        status: stripeSubscription.status,
                        stripe_price_id: stripeSubscriptionItem.plan.id,
                        current_period_start: new Date(stripeSubscriptionItem.current_period_start * 1000),
                        current_period_end: new Date(stripeSubscriptionItem.current_period_end * 1000),
                        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
                        user_id: stripeSubscription.metadata.userId ? parseInt(stripeSubscription.metadata.userId) : null,
                        organization_id: stripeSubscription.metadata.organizationId ? parseInt(stripeSubscription.metadata.organizationId) : null,
                    };

                    console.log('gg1 Mapped data for core.subscriptions:');
                    console.log(mappedData);

                    const paymentService = getPaymentService(c);
                    const userService = getUserService(c);
                    const organizationService = getOrganizationService(c);

                    if (!paymentService) {
                        console.log('NO PAYMENT SERVICE AVAILABLE');
                    }

                    if (!userService) {
                        console.log('NO USER SERVICE AVAILABLE');
                    }

                    if (!organizationService) {
                        console.log('NO ORGANIZATION SERVICE AVAILABLE');
                    }

                    const createdSubscription = await paymentService?.createSubscription({
                        subscription: mappedData
                    })

                    console.log('createdSubscription: ', createdSubscription);


                    // Placeholder: Logic to find user_id/organization_id based on mappedData.stripe_customer_id
                    // Example using a hypothetical paymentService available on context variables:
                    // if (c.var.paymentService) { 
                    //   const { userId, organizationId } = await c.var.paymentService.findOwnerForStripeCustomerId(mappedData.stripe_customer_id);
                    //   const dataToSave: Insertable<CoreSubscription> = {
                    //      ...mappedData,
                    //      user_id: userId || null, // Ensure it's null if not found
                    //      organization_id: organizationId || null, // Ensure it's null if not found
                    //      created_at: new Date(stripeSubscription.created * 1000), // if you want to use Stripe's created time
                    //   };
                    //   await c.var.paymentService.createSubscription({ subscription: dataToSave });
                    // }

                    console.log('============================================================');
                    break;
                }
                default:
                    console.log(`Unhandled event type ${event.type} via /webhooks/stripe`);
                    break;
            }

            return c.text('', 200);
        } catch (err) {
            const errorMessage = `⚠️  Webhook signature verification failed. ${err instanceof Error ? err.message : 'Internal server error'
                }`
            console.log(errorMessage);
            return c.text(errorMessage, 400);
        }
    });

    return app;
} 