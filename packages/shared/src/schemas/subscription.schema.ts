    import { z } from "zod";

    export const subscriptionSchema = z.object({
        id: z.string(),
        plan: z.string(),
        company_id: z.string(),
        stripe_customer_id: z.string().nullable().optional(),
        stripe_subscription_id: z.string().nullable().optional(),
        status: z.string(),
        period_start: z.date().nullable().optional(),
        period_end: z.date().nullable().optional(),
        cancel_at_period_end: z.boolean().nullable().optional(),
        seats: z.number().nullable().optional(),
        trial_start: z.date().nullable().optional(),
        trial_end: z.date().nullable().optional(),
        created_at: z.date(),
        updated_at: z.date(),
    });

    export type SharedSubscriptionDTO = z.infer<typeof subscriptionSchema>;