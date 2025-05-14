import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { createAppInstance, AppVariables } from '../../src/create-app';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely } from 'kysely';
import { DB, AuthUser, CoreSubscription } from '../../src/db/db-types';
import { Insertable } from 'kysely';
import { hashPassword } from '../../src/lib/crypto';
import { getDb } from '../../src/lib/db';
import Stripe from 'stripe';
import { UserDTO } from '@gefakit/shared';

// Import service/repo factories
import { createPaymentRepository } from '../../src/features/payments/payment.repository';
import { createPaymentService } from '../../src/features/payments/payment.service';
import { createUserRepository } from '../../src/features/users/user.repository';
import { createUserService } from '../../src/features/users/user.service';

// Define the expected signature for Stripe's constructEventAsync for precise mocking
type StripeConstructEventAsyncFn = (
  payload: string | Buffer,
  sig: string,
  secret: string,
  tolerance?: number,
  cryptoProvider?: Stripe.CryptoProvider // Stripe.CryptoProvider is a valid type from the 'stripe' package
) => Promise<Stripe.Event>;

// Mock Stripe Instance
const mockStripeInstance = {
  charges: {
    create: vi.fn().mockResolvedValue({ id: 'ch_test_mock_payment', status: 'succeeded' }),
  },
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test_mock_payment' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'cus_test_mock_payment', deleted: false }),
  },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({
        id: 'cs_test_mock_payment',
        url: 'https://checkout.stripe.com/mock',
        client_secret: 'cs_secret_mock',
      }),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn().mockResolvedValue({
        url: 'https://billing.stripe.com/mock',
      }),
    },
  },
  webhooks: {
    constructEventAsync: vi.fn() as Mock<StripeConstructEventAsyncFn>,
  }
} as unknown as Stripe;

// --- Test Suite Setup ---
describe('Payment API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let testUser: UserDTO | undefined;
  let sessionCookie: string;
  let testApp: Hono<{ Bindings: Bindings, Variables: AppVariables }>;

  beforeAll(async () => {
    console.log('================ payment.integration.test.ts =================')
    console.log('WITH NODE_ENV: ', process.env.NODE_ENV)
    console.log('WITH TEST_DATABASE_URL: ', process.env.TEST_DATABASE_URL)
    const dbUrl = process.env.TEST_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("TEST_DATABASE_URL environment variable not set.");
    }

    // Use the getDb function to create the Kysely instance for tests
    testDb = getDb({ connectionString: dbUrl, useHyperdrive: false });

    // Instantiate dependencies for testing
    const testPaymentRepository = createPaymentRepository({ db: testDb });
    const testUserRepository = createUserRepository({ db: testDb });
    const testUserService = createUserService({ userRepository: testUserRepository });
    const testPaymentService = createPaymentService({
      paymentRepository: testPaymentRepository,
      userService: testUserService,
      stripe: mockStripeInstance
    });

    // Assemble dependencies
    const testDependencies: Partial<AppVariables> = {
      db: testDb,
      paymentService: testPaymentService,
      userService: testUserService,
      stripe: mockStripeInstance,
    };

    // Create app instance with injected dependencies
    testApp = createAppInstance({ dependencies: testDependencies });

    const testPassword = 'password1234';
    const hashedPassword = await hashPassword(testPassword);
    const userEmail = `testuser-${Date.now()}@payment-integration.com`;
    const userInsert: Insertable<AuthUser> = {
      email: userEmail,
      username: `testuser-${Date.now()}`,
      password_hash: hashedPassword,
      email_verified: true,
      stripe_customer_id: 'cus_test_mock_payment' // Pre-set for some tests
    };

    const insertedUser = await testDb.insertInto('auth.users')
      .values(userInsert)
      .returningAll()
      .executeTakeFirstOrThrow();
    testUser = insertedUser;

    const loginRes = await testApp.request('/api/v1/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: testPassword }),
    });

    expect(loginRes.status).toBe(200);
    const setCookieHeader = loginRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeDefined();
    if (!setCookieHeader) {
      throw new Error('Set-Cookie header not found in login response');
    }
    sessionCookie = setCookieHeader;
  });

  afterAll(async () => {
    if (testDb && testUser) {
      try {
        // Clean up subscriptions
        await testDb.deleteFrom('core.subscriptions')
          .where('user_id', '=', testUser.id)
          .execute();

        // Clean up user
        await testDb.deleteFrom('auth.users')
          .where('id', '=', testUser.id)
          .execute();
      } catch (error) {
        console.error(`Error cleaning up test data:`, error);
      }
    }

    if (testDb) {
      await testDb.destroy();
    }
  });

  // Clean up after each test
  afterEach(async () => {
    if (testDb && testUser) {
      try {
        // Delete subscriptions associated with the test user
        await testDb.deleteFrom('core.subscriptions')
          .where('user_id', '=', testUser.id)
          .execute();
      } catch (error) {
        console.error(`Error cleaning up subscriptions:`, error);
      }
    }

    // Reset the mock calls
    vi.clearAllMocks();
  });

  describe('POST /api/v1/payments/checkout-session', () => {
    it('should create a checkout session for the authenticated user', async () => {
      const checkoutData = {
        priceId: 'price_test_mock_payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      };

      const res = await testApp.request('/api/v1/payments/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(checkoutData),
      });

      expect(res.status).toBe(200);
      const responseData = await res.json() as any;
      expect(responseData.checkoutSession).toBeDefined();
      expect(responseData.checkoutSession.sessionId).toBe('cs_test_mock_payment');
      expect(responseData.checkoutSession.sessionUrl).toBe('https://checkout.stripe.com/mock');

      // Verify Stripe was called correctly
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_test_mock_payment',
        line_items: [{ price: checkoutData.priceId, quantity: 1 }],
        success_url: checkoutData.successUrl,
        cancel_url: checkoutData.cancelUrl,
      }));
    });

    it('should return 401 if not authenticated', async () => {
      const checkoutData = {
        priceId: 'price_test_mock_payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      };

      const res = await testApp.request('/api/v1/payments/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No session cookie
        },
        body: JSON.stringify(checkoutData),
      });

      expect(res.status).toBe(401);
    });

    it('should return 400 if required fields are missing', async () => {
      const invalidData = {
        // Missing priceId
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      };

      const res = await testApp.request('/api/v1/payments/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(invalidData),
      });

      expect(res.status).toBe(400);
      const errorData = await res.json() as any;
      expect(errorData.ok).toBe(false);
      expect(errorData.errors).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/payments/customer-portal', () => {
    it('should create a customer portal session for the authenticated user', async () => {
      const res = await testApp.request('/api/v1/payments/customer-portal', {
        method: 'GET',
        headers: {
          'Cookie': sessionCookie,
        },
      });

      expect(res.status).toBe(200);
      const responseData = await res.json() as any;
      expect(responseData.url).toBeDefined();
      expect(responseData.url.url).toBe('https://billing.stripe.com/mock');

      // Verify Stripe was called correctly
      expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_test_mock_payment',
        return_url: expect.any(String),
      }));
    });

    it('should return 401 if not authenticated', async () => {
      const res = await testApp.request('/api/v1/payments/customer-portal', {
        method: 'GET',
        // No session cookie
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Webhooks', () => {
    beforeEach(() => {
      if (!testUser || typeof testUser.id === 'undefined') {
        throw new Error('Test user or testUser.id is not defined for webhook mock setup');
      }

      (mockStripeInstance.webhooks.constructEventAsync as Mock<StripeConstructEventAsyncFn>).mockImplementation(
        async (payloadBody, sig, endpointSecret, tolerance, cryptoProvider): Promise<Stripe.Event> => {
          // Parse the incoming request body from the test
          const payload = JSON.parse(payloadBody.toString());

          // Construct a Stripe.Event-like object using data from the payload
          return {
            id: 'evt_mock_' + Date.now() + Math.random().toString(36).substring(2), // Unique mock event ID
            object: 'event', // Stripe.Event has an 'object' property
            type: payload.type, // Use type from the test payload
            api_version: '2020-08-27', // Example API version, or make it dynamic if needed
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            pending_webhooks: 0,
            request: {
              id: 'req_mock_' + Date.now() + Math.random().toString(36).substring(2), // Unique mock request ID
              idempotency_key: null
            },
            data: {
              object: payload.data.object // This ensures metadata.userId comes from the test's request
            }
          } as Stripe.Event; // Cast to Stripe.Event
        }
      );
    });

    it('should handle subscription creation webhook', async () => {
      const mockSignature = 'mock_signature'; // Kept for header consistency, though mock bypasses strict need

      const res = await testApp.request('/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': mockSignature
        },
        body: JSON.stringify({
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_test_webhook',
              customer: 'cus_test_mock_payment',
              status: 'active',
              items: {
                data: [{
                  id: 'si_test_webhook',
                  plan: { id: 'price_test_webhook' },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                }]
              },
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              cancel_at_period_end: false,
              metadata: { userId: testUser?.id.toString() }
            }
          }
        })
      });

      // In a proper test, we would assert these:
      expect(res.status).toBe(200);
      expect(mockStripeInstance.webhooks.constructEventAsync).toHaveBeenCalled();
    });
  });
});