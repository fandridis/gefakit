import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-validator";

import { AppVariables } from "../../create-app";
import { getAuthOrThrow } from "../../utils/get-auth-or-throw";
import { getPaymentService, getUserService } from "../../utils/get-service";
import { Stripe } from "stripe";
import { z } from "zod";
import { paymentErrors } from "./payment.errors";

type StripeAppVariables = AppVariables & {
    stripe: Stripe;
}

export function createPaymentRoutesV1() {
    const app = new Hono<{ Bindings: Bindings; Variables: StripeAppVariables }>();

    // health check 
    app.get("/health", async (c) => {
        return c.json({ ok: true });
    });

    // GET /api/v1/todos - Get all todos for the current user
    app.post('/checkout-session', zValidator('json', z.object({
        priceId: z.string(),
        successUrl: z.string(),
        cancelUrl: z.string(),
    })), async (c) => {
        const { user } = getAuthOrThrow(c);
        const data = c.req.valid('json');

        const paymentService = getPaymentService(c);
        const checkoutSession = await paymentService.createCheckoutSession({
            userId: user.id,
            priceId: data.priceId,
            successUrl: data.successUrl,
            cancelUrl: data.cancelUrl,
        });

        if (checkoutSession.stripeCustomerIdToUpdate) {
            const userService = getUserService(c);
            await userService.updateUser({
                userId: user.id,
                updates: { stripe_customer_id: checkoutSession.stripeCustomerIdToUpdate }
            });
        }

        return c.json({ checkoutSession });
    })

    app.get('/customer-portal', async (c) => {
        const { user } = getAuthOrThrow(c)

        if (!user.stripe_customer_id) {
            throw paymentErrors.missingStripeCustomerId();
        }

        const paymentService = getPaymentService(c);
        const portalSession = await paymentService.createCustomerPortalSession({
            userId: user.id,
        });

        return c.json({ url: portalSession });
    });

    // Example of single payment checkout session
    // app.get("/a", async (context) => {
    //     const stripe = context.get('stripe');

    //     const session = await stripe.checkout.sessions.create({
    //         payment_method_types: ["card"],
    //         line_items: [
    //             {
    //                 price_data: {
    //                     currency: "usd",
    //                     product_data: {
    //                         name: "T-shirt",
    //                     },
    //                     unit_amount: 2000,
    //                 },
    //                 quantity: 1,
    //             },
    //         ],
    //         mode: "payment",
    //         shipping_address_collection: {
    //             allowed_countries: ['GR', 'LT'], // Add or modify countries as needed
    //         },
    //         shipping_options: [
    //             {
    //                 shipping_rate_data: {
    //                     type: 'fixed_amount',
    //                     display_name: 'Normal shipping',
    //                     fixed_amount: {
    //                         amount: 5,
    //                         currency: 'usd',
    //                     },
    //                     delivery_estimate: {
    //                         minimum: {
    //                             unit: 'business_day',
    //                             value: 5,
    //                         },
    //                         maximum: {
    //                             unit: 'business_day',
    //                             value: 9,
    //                         },
    //                     },
    //                 },
    //             },
    //             {
    //                 shipping_rate_data: {
    //                     type: 'fixed_amount',
    //                     display_name: 'Express shipping',
    //                     fixed_amount: {
    //                         amount: 9,
    //                         currency: 'usd',
    //                     },
    //                     delivery_estimate: {
    //                         minimum: {
    //                             unit: 'business_day',
    //                             value: 3,
    //                         },
    //                         maximum: {
    //                             unit: 'business_day',
    //                             value: 5,
    //                         },
    //                     },
    //                 },
    //             },

    //         ],
    //         success_url: "https://example.com/success",
    //         cancel_url: "https://example.com/cancel",
    //     });
    //     return context.redirect(session.url as string, 303);
    // });

    return app;
}
