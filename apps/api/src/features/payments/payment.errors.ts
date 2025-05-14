import { ApiError } from "@gefakit/shared";

export const paymentErrors = {
  userNotFound: (userId: number) => new ApiError(`User with ID ${userId} not found`, 404, { code: 'PAYMENT_USER_NOT_FOUND' }),
  missingStripeCustomerId: () => new ApiError('User does not have billing enabled', 400, { code: 'PAYMENT_MISSING_STRIPE_CUSTOMER_ID' }),
  stripeCustomerNotFound: (customerId: string) => new ApiError(`Stripe customer ID ${customerId} not found`, 404, { code: 'PAYMENT_STRIPE_CUSTOMER_NOT_FOUND' }),
  subscriptionNotFound: () => new ApiError('Subscription not found', 404, { code: 'PAYMENT_SUBSCRIPTION_NOT_FOUND' }),
  organizationNotFound: (organizationId: number) => new ApiError(`Organization with ID ${organizationId} not found`, 404, { code: 'PAYMENT_ORGANIZATION_NOT_FOUND' }),
  stripeError: (message: string) => new ApiError(`Stripe API error: ${message}`, 500, { code: 'PAYMENT_STRIPE_ERROR' }),
} as const;