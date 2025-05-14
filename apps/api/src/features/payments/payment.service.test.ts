import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaymentService, PaymentService } from './payment.service';
import { paymentErrors } from './payment.errors';
import { Stripe } from 'stripe';
import { UserDTO } from '@gefakit/shared';

// Mock repository
type MockPaymentRepositoryInstance = {
  findSubscriptionByUserId: ReturnType<typeof vi.fn>;
  findSubscriptionByOrganizationId: ReturnType<typeof vi.fn>;
  findSubscriptionByStripeSubscriptionId: ReturnType<typeof vi.fn>;
  createSubscription: ReturnType<typeof vi.fn>;
  updateSubscriptionByStripeSubscriptionId: ReturnType<typeof vi.fn>;
  deleteSubscription: ReturnType<typeof vi.fn>;
};

// Mock user service
type MockUserServiceInstance = {
  findUserById: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
};

// Mock Stripe objects
const mockStripeCustomer = {
  id: 'cus_mock12345',
  deleted: false,
  email: 'test@example.com',
};

const mockStripeSubscription = {
  id: 'sub_mock12345',
  status: 'active',
  customer: 'cus_mock12345',
  items: {
    data: [
      {
        id: 'si_mock12345',
        price: { id: 'price_mock12345' },
        current_period_start: 1609459200, // 2021-01-01
        current_period_end: 1612137600, // 2021-02-01
      }
    ]
  },
  current_period_start: 1609459200, // 2021-01-01
  current_period_end: 1612137600, // 2021-02-01
  cancel_at_period_end: false,
  metadata: {
    userId: '123'
  }
};

const mockStripeSession = {
  id: 'cs_mock12345',
  url: 'https://checkout.stripe.com/mock',
};

const mockStripePortalSession = {
  url: 'https://billing.stripe.com/mock',
};

// Mock Stripe client
const createMockStripe = () => ({
  customers: {
    retrieve: vi.fn().mockResolvedValue(mockStripeCustomer),
    create: vi.fn().mockResolvedValue(mockStripeCustomer),
  },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue(mockStripeSession),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue(mockStripePortalSession),
    },
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue(mockStripeSubscription),
  },
  webhooks: {
    constructEventAsync: vi.fn().mockResolvedValue({
      type: 'customer.subscription.updated',
      data: {
        object: mockStripeSubscription
      }
    }),
  }
}) as unknown as Stripe;

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockPaymentRepo: MockPaymentRepositoryInstance;
  let mockUserService: MockUserServiceInstance;
  let mockStripe: Stripe;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockPaymentRepo = {
      findSubscriptionByUserId: vi.fn(),
      findSubscriptionByOrganizationId: vi.fn(),
      findSubscriptionByStripeSubscriptionId: vi.fn(),
      createSubscription: vi.fn(),
      updateSubscriptionByStripeSubscriptionId: vi.fn(),
      deleteSubscription: vi.fn(),
    };

    mockUserService = {
      findUserById: vi.fn(),
      updateUser: vi.fn(),
    };

    mockStripe = createMockStripe();

    // Create service instance
    paymentService = createPaymentService({
      paymentRepository: mockPaymentRepo,
      userService: mockUserService,
      stripe: mockStripe,
    });
  });

  describe('findSubscriptionByUserId', () => {
    it('should call repository.findSubscriptionByUserId with the correct userId', async () => {
      const userId = 123;
      const mockSubscription = { id: 1, user_id: userId, stripe_subscription_id: 'sub_123' };
      mockPaymentRepo.findSubscriptionByUserId.mockResolvedValue(mockSubscription);

      const result = await paymentService.findSubscriptionByUserId({ userId });

      expect(mockPaymentRepo.findSubscriptionByUserId).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('createCheckoutSession', () => {
    const userId = 123;
    const priceId = 'price_123';
    const successUrl = 'https://example.com/success';
    const cancelUrl = 'https://example.com/cancel';

    it('should throw userNotFound error if user does not exist', async () => {
      mockUserService.findUserById.mockResolvedValue(null);

      await expect(
        paymentService.createCheckoutSession({ userId, priceId, successUrl, cancelUrl })
      ).rejects.toThrow(paymentErrors.userNotFound(userId));

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should create a checkout session for a user with existing stripe customer id', async () => {
      const mockUser: UserDTO = {
        id: userId,
        email: 'test@example.com',
        stripe_customer_id: 'cus_existing',
        email_verified: true,
        role: 'user',
        username: 'testuser',
        created_at: new Date()
      };
      mockUserService.findUserById.mockResolvedValue(mockUser);

      const result = await paymentService.createCheckoutSession({
        userId,
        priceId,
        successUrl,
        cancelUrl,
      });

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(mockUser.stripe_customer_id);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        customer: mockStripeCustomer.id,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      }));
      expect(result).toEqual({
        sessionId: mockStripeSession.id,
        sessionUrl: mockStripeSession.url,
        stripeCustomerIdToUpdate: undefined // No update needed as customer already exists
      });
    });

    it('should create a checkout session and return customer ID to update for a new user', async () => {
      const mockUser: UserDTO = {
        id: userId,
        email: 'test@example.com',
        stripe_customer_id: null,
        email_verified: true,
        role: 'user',
        username: 'testuser',
        created_at: new Date()
      };
      mockUserService.findUserById.mockResolvedValue(mockUser);

      const result = await paymentService.createCheckoutSession({
        userId,
        priceId,
        successUrl,
        cancelUrl,
      });

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockStripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({
        email: mockUser.email,
        metadata: { internal_user_id: mockUser.id.toString() }
      }));
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
      expect(result).toEqual({
        sessionId: mockStripeSession.id,
        sessionUrl: mockStripeSession.url,
        stripeCustomerIdToUpdate: mockStripeCustomer.id
      });
    });
  });

  describe('createCustomerPortalSession', () => {
    const userId = 123;

    it('should throw userNotFound error if user does not exist', async () => {
      mockUserService.findUserById.mockResolvedValue(null);

      await expect(
        paymentService.createCustomerPortalSession({ userId })
      ).rejects.toThrow(paymentErrors.userNotFound(userId));

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
    });

    it('should throw missingStripeCustomerId error if user has no stripe customer id', async () => {
      const mockUser: UserDTO = {
        id: userId,
        email: 'test@example.com',
        stripe_customer_id: null,
        email_verified: true,
        role: 'user',
        username: 'testuser',
        created_at: new Date()
      };
      mockUserService.findUserById.mockResolvedValue(mockUser);

      await expect(
        paymentService.createCustomerPortalSession({ userId })
      ).rejects.toThrow(paymentErrors.missingStripeCustomerId());

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
    });

    it('should create a customer portal session for a valid user', async () => {
      const mockUser: UserDTO = {
        id: userId,
        email: 'test@example.com',
        stripe_customer_id: 'cus_existing',
        email_verified: true,
        role: 'user',
        username: 'testuser',
        created_at: new Date()
      };
      mockUserService.findUserById.mockResolvedValue(mockUser);

      const result = await paymentService.createCustomerPortalSession({ userId });

      expect(mockUserService.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        customer: mockUser.stripe_customer_id,
        return_url: expect.any(String)
      }));
      expect(result).toEqual(mockStripePortalSession);
    });
  });

  describe('createSubscription', () => {
    it('should call repository.createSubscription with the correct data', async () => {
      const subscriptionData = {
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
        user_id: 123,
        status: 'active',
        stripe_price_id: 'price_123',
        current_period_start: new Date(),
        current_period_end: new Date()
      };
      const createdSubscription = { ...subscriptionData, id: 1 };
      mockPaymentRepo.createSubscription.mockResolvedValue(createdSubscription);

      const result = await paymentService.createSubscription({ subscription: subscriptionData });

      expect(mockPaymentRepo.createSubscription).toHaveBeenCalledWith({ subscription: subscriptionData });
      expect(result).toEqual(createdSubscription);
    });
  });

  describe('updateSubscriptionByStripeSubscriptionId', () => {
    it('should call repository.updateSubscriptionByStripeSubscriptionId with the correct data', async () => {
      const stripeSubscriptionId = 'sub_123';
      const subscriptionData = {
        status: 'active',
        current_period_end: new Date()
      };
      const updatedSubscription = { id: 1, stripe_subscription_id: stripeSubscriptionId, ...subscriptionData };
      mockPaymentRepo.updateSubscriptionByStripeSubscriptionId.mockResolvedValue(updatedSubscription);

      const result = await paymentService.updateSubscriptionByStripeSubscriptionId({
        stripeSubscriptionId,
        subscription: subscriptionData
      });

      expect(mockPaymentRepo.updateSubscriptionByStripeSubscriptionId).toHaveBeenCalledWith({
        stripeSubscriptionId,
        subscription: subscriptionData
      });
      expect(result).toEqual(updatedSubscription);
    });
  });

  describe('deleteSubscription', () => {
    it('should call repository.deleteSubscription with the correct id', async () => {
      const id = 123;
      const deletedSubscription = { id, stripe_subscription_id: 'sub_123' };
      mockPaymentRepo.deleteSubscription.mockResolvedValue(deletedSubscription);

      const result = await paymentService.deleteSubscription({ id });

      expect(mockPaymentRepo.deleteSubscription).toHaveBeenCalledWith({ id });
      expect(result).toEqual(deletedSubscription);
    });
  });
});