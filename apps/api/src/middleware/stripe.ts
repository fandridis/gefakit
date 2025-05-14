import { Context, Next } from 'hono';
import Stripe from 'stripe';

/**
 * Middleware to initialize and inject the Stripe client into the context.
 *
 * It first checks if a Stripe instance is provided via injection.
 * If not, it attempts to initialize Stripe using the STRIPE_SECRET_KEY
 * environment variable.
 *
 * If a Stripe instance is available (either injected or initialized),
 * it sets it on the context using c.set('stripe', stripeInstance).
 */
export const stripeMiddleware = (injectedStripe?: Stripe) => {
    return async (c: Context, next: Next) => {
        let stripeInstance: Stripe | undefined = injectedStripe;

        // If not injected, try to initialize from environment variables
        if (!stripeInstance) {
            const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
            if (!stripeSecretKey) {
                // Decide how to handle missing key: log, throw, or proceed without Stripe?
                // For critical features, throwing might be appropriate.
                console.error('Stripe Middleware: STRIPE_SECRET_KEY is not set in environment variables.');
                // Optionally: return c.json({ ok: false, error: 'Stripe configuration error' }, 500);
            } else {
                try {
                    stripeInstance = new Stripe(stripeSecretKey, {
                        apiVersion: '2025-04-30.basil', // Ensure this matches your Stripe library expectations
                        typescript: true,
                    });
                    console.log('Stripe Middleware: Initialized Stripe from environment variable.');
                } catch (error) {
                    console.error('Stripe Middleware: Failed to initialize Stripe:', error);
                    // Optionally: return c.json({ ok: false, error: 'Stripe initialization failed' }, 500);
                }
            }
        } else {
            console.log('Stripe Middleware: Using injected Stripe instance.');
        }

        // Set the instance on the context if available
        if (stripeInstance) {
            c.set('stripe', stripeInstance);
        }

        await next();
    };
}; 