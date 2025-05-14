import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Stripe from 'stripe';

// Hoist the mock function definition
const { mockSendEmail } = vi.hoisted(() => {
  return { mockSendEmail: vi.fn().mockResolvedValue(undefined) };
});

// Mock EmailService *before* app import
vi.mock('../../src/features/emails/email.service', () => {
  const mockServiceInstance = {
    sendOrganizationInvitationEmail: mockSendEmail, // Use the hoisted mock
    // Add other methods used by the application if necessary
    // sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  };
  return {
    EmailService: vi.fn().mockImplementation(() => mockServiceInstance),
    createEmailService: vi.fn(() => mockServiceInstance),
  };
});

// Import factory and types
// import app from '../../src/index';
import { createAppInstance, AppVariables } from '../../src/create-app';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely } from 'kysely';
import { DB, AuthUser } from '../../src/db/db-types';
import { Insertable } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { hashPassword } from '../../src/lib/crypto';
import { UserDTO, OrganizationDTO, CreateOrganizationInvitationResponseDTO } from '@gefakit/shared';
import { getDb } from '../../src/lib/db';

// Mock environment variables
// vi.stubEnv('DATABASE_URL_POOLED', 'postgresql://neondb_owner:npg_v9IioTkZd6RY@ep-withered-heart-a2fk19ng-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require');

describe('Organization API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let testUser: UserDTO | undefined;
  let sessionCookie: string;
  let testApp: Hono<{ Bindings: Bindings, Variables: AppVariables }>; // Declare testApp

  // Define mockStripeInstance
  const mockStripeInstance = {
    charges: {
      create: vi.fn().mockResolvedValue({ id: 'ch_test_mock', status: 'succeeded' }),
      // Add other charge methods if your app uses them e.g. retrieve, list, etc.
    },
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test_mock' }),
      // Add other customer methods e.g. retrieve, update, delete, listPaymentMethods, etc.
    },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: 'pi_test_mock', client_secret: 'pi_test_mock_secret', status: 'requires_payment_method' }),
      // Add other PI methods like confirm, retrieve, etc.
    },
    setupIntents: {
      create: vi.fn().mockResolvedValue({ id: 'seti_test_mock', client_secret: 'seti_test_mock_secret', status: 'requires_payment_method' }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_test_mock', status: 'active' }),
    },
    // Add other Stripe services like prices, products, invoices, webhooks etc. if needed
  } as unknown as Stripe; // Cast to Stripe type for type safety

  beforeAll(async () => {
    const dbUrl = process.env.TEST_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("TEST_DATABASE_URL environment variable not set.");
    }

    console.log(`[organization.integration.test] Getting DB instance with connectionString: ${dbUrl}`);

    testDb = getDb({ connectionString: dbUrl, useHyperdrive: false });

    // Create test app instance
    const testDependencies: Partial<AppVariables> = {
      db: testDb,
      stripe: mockStripeInstance, // Pass the mock Stripe instance
    };
    testApp = createAppInstance({ dependencies: testDependencies });

    const testPassword = 'password1234orgtest';
    const hashedPassword = await hashPassword(testPassword);
    const userEmail = `testuser-org-${Date.now()}@integration.com`;
    const userInsert: Insertable<AuthUser> = {
      email: userEmail,
      username: `testuser-org-${Date.now()}`,
      password_hash: hashedPassword,
      email_verified: true,
    };

    // Always create a new user for this test suite run
    testUser = await testDb.insertInto('auth.users')
      .values(userInsert)
      .returningAll()
      .executeTakeFirstOrThrow() as UserDTO;

    // Log in the test user - Use testApp
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
        // Clean up organizations and memberships first if necessary
        const memberships = await testDb.selectFrom('organizations.memberships')
          .where('user_id', '=', testUser.id)
          .select('organization_id')
          .execute();
        const orgIds = memberships.map(m => m.organization_id);

        if (orgIds.length > 0) {
          // Delete memberships associated with the user
          await testDb.deleteFrom('organizations.memberships')
            .where('user_id', '=', testUser.id)
            .execute();


          // Optionally, delete organizations if the test user was the only member/owner
          // Be careful with this if organizations might be shared in tests or if cleanup is complex
          // For simplicity, we might only delete organizations fully owned AND created by this test user.
          // A safer approach might be to delete orgs created in specific tests within afterEach.
          const ownedOrgs = await testDb.selectFrom('organizations.organizations as org')
            .innerJoin('organizations.memberships as mem', 'mem.organization_id', 'org.id')
            .where('mem.user_id', '=', testUser.id)
            .where('mem.role', '=', 'owner')
            .where('org.id', 'in', orgIds) // Only consider orgs the user was part of
            // Add a check to ensure the user is the *only* owner or member if needed
            .select('org.id')
            .execute();

          const ownedOrgIds = ownedOrgs.map(o => o.id);
          if (ownedOrgIds.length > 0) {
            // Delete memberships for these orgs first (including other users if any test added them)
            await testDb.deleteFrom('organizations.memberships')
              .where('organization_id', 'in', ownedOrgIds)
              .execute();
            // Then delete the organizations
            await testDb.deleteFrom('organizations.organizations')
              .where('id', 'in', ownedOrgIds)
              .execute();
          }
        }

        // Now delete the user
        await testDb.deleteFrom('auth.users')
          .where('id', '=', testUser.id)
          .execute();
      } catch (error) {
        console.error(`[organization.integration.test] Error during cleanup ${testUser.email}:`, error);
      }
    }

    if (testDb) {
      await testDb.destroy();
      // console.log('Test database connection closed.');
    } else {
      // console.log('No test database connection to close.');
    }
  });

  // beforeEach(async () => {});

  afterEach(async () => {
    // Clean up resources created *during* a specific test
    // For example, delete specific organizations created ONLY in that test
    // This provides better isolation than relying solely on afterAll
    if (testDb && testUser) {
      // Example: Delete all orgs created by the test user to ensure clean slate for next test
      // This might be too broad; adjust based on test needs.
      try {
        const memberships = await testDb.selectFrom('organizations.memberships')
          .where('user_id', '=', testUser.id)
          .where('role', '=', 'owner') // Assuming creator becomes owner
          .select('organization_id')
          .execute();
        const orgIds = memberships.map(m => m.organization_id);

        if (orgIds.length > 0) {
          // Cascade or delete dependencies first (e.g., memberships)
          await testDb.deleteFrom('organizations.memberships')
            .where('organization_id', 'in', orgIds)
            .execute();
          // Then delete the organizations
          await testDb.deleteFrom('organizations.organizations')
            .where('id', 'in', orgIds)
            .execute();
        }
      } catch (error) {
        console.error(`[organization.integration.test] Error cleaning up orgs for user ${testUser.email} in afterEach:`, error);
      }
    } else {
      // console.warn("Skipping test cleanup in afterEach: testDb or testUser not available.");
    }
  });

  // --- Test Cases ---
  describe('POST /api/v1/organizations', () => {
    it('should create a new organization for the authenticated user', async () => {
      const newOrgData = {
        name: 'Test Integration Organization',
        stripe_customer_id: 'cus_test_mock',
      };

      // Use testApp
      const res = await testApp.request('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(newOrgData),
      });

      expect(res.status).toBe(201);
      const { createdOrganization } = await res.json() as { createdOrganization: OrganizationDTO }; // Assuming the endpoint returns the created org

      expect(createdOrganization).toBeDefined();
      expect(createdOrganization.id).toBeTypeOf('number');
      expect(createdOrganization.name).toBe(newOrgData.name);

      // Verify in database
      const dbOrg = await testDb.selectFrom('organizations.organizations')
        .where('id', '=', createdOrganization.id)
        .selectAll()
        .executeTakeFirst();

      expect(dbOrg).toBeDefined();
      expect(dbOrg?.name).toBe(newOrgData.name);

      // Verify membership (creator should be owner)
      const dbMembership = await testDb.selectFrom('organizations.memberships')
        .where('organization_id', '=', createdOrganization.id)
        .where('user_id', '=', testUser!.id)
        .selectAll()
        .executeTakeFirst();

      expect(dbMembership).toBeDefined();
      expect(dbMembership?.role).toBe('owner');
      expect(dbMembership?.is_default).toBe(false); // Or true if it should be default initially
    });

    it('should return 401 Unauthorized if no session cookie is provided', async () => {
      const newOrgData = { name: 'Unauthorized Org Test' };

      // Use testApp
      const res = await testApp.request('/api/v1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // No Cookie
        body: JSON.stringify(newOrgData),
      });

      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request if request body is invalid (e.g., missing name)', async () => {
      const invalidOrgData = {}; // Missing 'name'

      // Use testApp
      const res = await testApp.request('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(invalidOrgData),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.ok).toBe(false);
      expect(body.errors).toBeInstanceOf(Array);
      // Optional: check for specific error message related to 'name' field
      expect(body.errors.some((e: any) => e.field === 'name')).toBe(true);


      //   // Verify no organization was created
      //   If we want to do that, we should clear db before each test
      //     const countResult = await testDb.selectFrom('organizations.organizations')
      //         .select(({ fn }) => [fn.count('id').as('count')])
      //         // Add a where clause if needed to narrow down, but checking total count might be enough
      //         // .where('name', '=', 'some specific name that should not exist')
      //         .executeTakeFirst();

      //     // Check if count is '0' or the count before the test started
      //     expect(countResult?.count).toBe("0"); // Assumes afterEach cleans up successfully
    });
  });

  // Invitations
  describe('POST /api/v1/organizations/:organizationId/invitations', () => {
    // Reset mock before each test in this describe block if needed
    beforeEach(() => {
      mockSendEmail.mockClear();
    });

    it('should create a new invitation for the authenticated user', async () => {
      // 1. Create an organization first to get an ID - Use testApp
      const orgName = `Test Org for Invite ${Date.now()}`;
      const createOrgRes = await testApp.request('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify({ name: orgName, stripe_customer_id: 'cus_test_mock' }),
      });
      expect(createOrgRes.status).toBe(201);
      const { createdOrganization } = await createOrgRes.json() as { createdOrganization: OrganizationDTO };
      const organizationId = createdOrganization.id;

      // 2. Mock setup done at top level

      // 3. Prepare invitation data
      const inviteEmail = `delivered@resend.dev`;
      const newInvitationData = {
        email: inviteEmail,
      };

      // 4. Send the request to create the invitation - Use testApp
      const res = await testApp.request(`/api/v1/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(newInvitationData),
      });

      // 5. Assertions for the response
      expect(res.status).toBe(201);
      const { createdInvitation } = await res.json() as CreateOrganizationInvitationResponseDTO;

      expect(createdInvitation).toBeDefined();
      expect(createdInvitation.id).toBeTypeOf('number');
      expect(createdInvitation.organization_id).toBe(organizationId);
      expect(createdInvitation.invited_by_user_id).toBe(testUser!.id);
      expect(createdInvitation.email).toBe(inviteEmail);
      expect(createdInvitation.role).toBe('member');
      expect(createdInvitation.status).toBe('pending');
      expect(createdInvitation.token).toBeTypeOf('string');
      expect(new Date(createdInvitation.expires_at)).toBeInstanceOf(Date);

      // 6. Verify in the database
      const dbInvitation = await testDb.selectFrom('organizations.invitations')
        .where('id', '=', createdInvitation.id)
        .selectAll()
        .executeTakeFirst();

      expect(dbInvitation).toBeDefined();
      // Assert properties directly, handling potential undefined
      expect(dbInvitation?.organization_id).toBe(organizationId);
      expect(dbInvitation?.invited_by_user_id).toBe(testUser!.id);
      expect(dbInvitation?.email).toBe(inviteEmail);
      expect(dbInvitation?.role).toBe('member');
      expect(dbInvitation?.status).toBe('pending');
      expect(dbInvitation?.token).toBe(createdInvitation.token);
      expect(dbInvitation?.expires_at).toBeInstanceOf(Date);

      // 7. Verify email service mock was called
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        email: inviteEmail,
        orgName: orgName,
        token: createdInvitation.token,
      });
    });
  });
}); 