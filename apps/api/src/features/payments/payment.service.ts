import { Insertable, Updateable } from "kysely";
import { CoreSubscription } from "../../db/db-types";
import { PaymentRepository } from "./payment.repository";
import Stripe from 'stripe';
import { UserDTO } from '@gefakit/shared';
import { UserService } from "../users/user.service";
import { paymentErrors } from "./payment.errors";


export type PaymentService = ReturnType<typeof createPaymentService>

interface CreatePaymentServiceDeps {
    userService: UserService;
    paymentRepository: PaymentRepository;
    stripe: Stripe;
}

export function createPaymentService({ paymentRepository, stripe, userService }: CreatePaymentServiceDeps) {
    async function findSubscriptionByUserId({ userId }: { userId: number }) {
        return paymentRepository.findSubscriptionByUserId({ userId });
    }

    async function findSubscriptionByOrganizationId({ organizationId }: { organizationId: number }) {
        return paymentRepository.findSubscriptionByOrganizationId({ organizationId });
    }


    async function findSubscriptionByStripeSubscriptionId({ stripeSubscriptionId }: { stripeSubscriptionId: string }) {
        return paymentRepository.findSubscriptionByStripeSubscriptionId({ stripeSubscriptionId });
    }

    async function getOrCreateStripeCustomerForUser({ user }: { user: UserDTO }): Promise<{ customer: Stripe.Customer, newStripeCustomerIdToPersist?: string }> {
        let newStripeCustomerIdToPersist: string | undefined = undefined;

        if (user.stripe_customer_id) {
            try {
                const customer = await stripe.customers.retrieve(user.stripe_customer_id);
                if (customer && !customer.deleted) {
                    console.log('Found existing Stripe customer for user', user.id);
                    return { customer }; // Already exists and is valid on the user object
                }
            } catch (error: any) {
                if (error.code === 'resource_missing') {
                    console.warn('Stripe customer ID on user record not found in Stripe, will create a new one:', error.message);
                } else {
                    console.warn('Failed to retrieve existing Stripe customer, will create a new one:', error.message);
                    // Re-throw as a payment error if needed
                    // throw paymentErrors.stripeError(error.message);
                }
                // Fall through to create a new one
            }
        }

        // If not found, invalid, or not set on user, create a new customer in Stripe
        console.log(`Creating Stripe customer for user ${user.id} with email ${user.email}`);
        const newCustomer = await stripe.customers.create({
            email: user.email,
            metadata: {
                internal_user_id: user.id.toString(),
            },
        });
        newStripeCustomerIdToPersist = newCustomer.id;
        console.log('Created new Stripe customer for user', user.id, ' ID:', newStripeCustomerIdToPersist);

        // The responsibility to save newStripeIdToPersist to the user record
        // is now on the caller of the service method that invokes this function.
        return { customer: newCustomer, newStripeCustomerIdToPersist };
    }

    async function getOrCreateStripeCustomerForOrganization({ organizationId }: { organizationId: number }): Promise<Stripe.Customer> {
        // Similar logic as for user: check DB first, then create in Stripe
        // TODO: Implement logic to check/save mapping for organizationId
        // This would also need access to an OrganizationService to get organization details
        // and a similar pattern of returning newStripeIdToPersist if an org's Stripe ID is created/updated.
        console.log(`Creating/Retrieving Stripe customer for organization ${organizationId}`);
        // Placeholder: Fetch organization details if needed
        // const organization = await organizationService.findById(organizationId);
        // if (!organization) {
        //    throw paymentErrors.organizationNotFound(organizationId);
        // }

        try {
            const customer = await stripe.customers.create({
                // email: organization.email, // Use organization's email if available
                name: `Organization ${organizationId}`, // Use organization name
                metadata: {
                    internal_organization_id: organizationId.toString(),
                },
            });
            // TODO: Save mapping for organizationId and potentially return new ID for persistence.
            return customer;
        } catch (error: any) {
            throw paymentErrors.stripeError(error.message);
        }
    }


    async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl }: { userId: number, priceId: string, successUrl: string, cancelUrl: string }) {
        const user = await userService.findUserById({ id: userId });
        if (!user) {
            throw paymentErrors.userNotFound(userId);
        }

        const { customer: stripeCustomer, newStripeCustomerIdToPersist } = await getOrCreateStripeCustomerForUser({ user });

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomer.id,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription', // Or 'payment' depending on your use case
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Optionally, pass the client_reference_id for reconciliation
            client_reference_id: user.id.toString(),
            // If you need to update payment method for future use with a subscription
            payment_method_collection: 'if_required',
            subscription_data: {
                metadata: {
                    userId: user.id.toString(),
                }
            }
        });

        return {
            sessionId: session.id,
            // This stripeCustomerIdToUpdate should be used by the caller to update the user record
            stripeCustomerIdToUpdate: newStripeCustomerIdToPersist,
            // The session URL can be useful for the client to redirect to
            sessionUrl: session.url
        };
    }

    async function createCustomerPortalSession({ userId }: { userId: number }) {
        const user = await userService.findUserById({ id: userId });

        if (!user) {
            throw paymentErrors.userNotFound(userId);
        }

        if (!user.stripe_customer_id) {
            throw paymentErrors.missingStripeCustomerId();
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: `${process.env.APP_URL}/settings/profile`,
        });

        return portalSession;
    }

    async function createSubscription({ subscription }: { subscription: Insertable<CoreSubscription> }) {
        return paymentRepository.createSubscription({ subscription });
    }

    async function updateSubscriptionByStripeSubscriptionId({ stripeSubscriptionId, subscription }: { stripeSubscriptionId: string, subscription: Updateable<CoreSubscription> }) {
        return paymentRepository.updateSubscriptionByStripeSubscriptionId({ stripeSubscriptionId, subscription });
    }

    async function deleteSubscription({ id }: { id: number }) {
        return paymentRepository.deleteSubscription({ id });
    }



    return {
        findSubscriptionByUserId,
        findSubscriptionByOrganizationId,
        findSubscriptionByStripeSubscriptionId,
        createSubscription,
        createCheckoutSession,
        getOrCreateStripeCustomerForOrganization,
        createCustomerPortalSession,
        updateSubscriptionByStripeSubscriptionId,
        deleteSubscription,
        // getOrCreateStripeCustomerForUser, // Expose if needed, otherwise keep internal
    };
}