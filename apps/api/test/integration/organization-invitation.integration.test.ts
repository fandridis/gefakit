import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Stripe from 'stripe';

// Hoist mock
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn().mockResolvedValue(undefined) }));

// Mock EmailService
vi.mock('../../src/features/emails/email.service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({ sendOrganizationInvitationEmail: mockSendEmail })),
  createEmailService: vi.fn(() => ({ sendOrganizationInvitationEmail: mockSendEmail })),
}));

// Import factory and types
// import app from '../../src/index';
import { createAppInstance, AppVariables } from '../../src/create-app';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely, Insertable, Selectable } from 'kysely';
import { DB, AuthUser, OrganizationsInvitation } from '../../src/db/db-types';
import { NeonDialect } from 'kysely-neon';
import { hashPassword } from '../../src/lib/crypto';
import { UserDTO, OrganizationDTO, CreateOrganizationInvitationResponseDTO } from '@gefakit/shared';
import { getDb } from '../../src/lib/db';

describe('Organization Invitation API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let senderUser: UserDTO;
  let receiverUser: UserDTO;
  let senderPassword = 'senderPassword123';
  let receiverPassword = 'receiverPassword456';
  let testOrg: OrganizationDTO;
  let senderSessionCookie: string;
  let testApp: Hono<{ Bindings: Bindings, Variables: AppVariables }>; // Declare testApp
  let testInvitation: Selectable<OrganizationsInvitation> | null = null;

  // Define mockStripeInstance
  const mockStripeInstance = {
    charges: {
      create: vi.fn().mockResolvedValue({ id: 'ch_test_mock_org_invite', status: 'succeeded' }),
    },
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test_mock_org_invite' }),
    },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: 'pi_test_mock_org_invite', client_secret: 'pi_org_invite_secret', status: 'requires_payment_method' }),
    },
    setupIntents: {
      create: vi.fn().mockResolvedValue({ id: 'seti_test_mock_org_invite', client_secret: 'seti_org_invite_secret', status: 'requires_payment_method' }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_test_mock_org_invite', status: 'active' }),
    },
  } as unknown as Stripe;

  // Helper to log in a user and return their session cookie
  const loginUser = async (email: string, password: string): Promise<string> => {
    // Use testApp
    const loginRes = await testApp.request('/api/v1/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get('Set-Cookie');
    expect(cookie).toBeDefined();
    return cookie!;
  };

  // Helper to create an organization (using sender's session)
  const createTestOrg = async (name: string): Promise<OrganizationDTO> => {
    // Use testApp
    const res = await testApp.request('/api/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': senderSessionCookie },
      body: JSON.stringify({ name, stripe_customer_id: 'cus_test_mock_org_invite' }),
    });
    expect(res.status).toBe(201);
    const { createdOrganization } = await res.json() as { createdOrganization: OrganizationDTO };
    return createdOrganization;
  };

  // Helper to create an invitation (using sender's session, inviting receiver)
  const createTestInvite = async (orgId: number, email: string): Promise<Selectable<OrganizationsInvitation>> => {
    mockSendEmail.mockClear();
    // Use testApp
    const res = await testApp.request(`/api/v1/organizations/${orgId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': senderSessionCookie }, // Use sender's session
      body: JSON.stringify({ email }), // Invite receiver's email
    });
    expect(res.status).toBe(201);
    const { createdInvitation } = await res.json() as CreateOrganizationInvitationResponseDTO;
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    return createdInvitation;
  };

  beforeAll(async () => {
    const dbUrl = process.env.TEST_DATABASE_URL;
    if (!dbUrl) throw new Error("TEST_DATABASE_URL not set.");
    testDb = getDb({ connectionString: dbUrl, useHyperdrive: false });

    // Create test app instance
    const testDependencies: Partial<AppVariables> = {
      db: testDb,
      stripe: mockStripeInstance, // Pass the mock Stripe instance
    };
    testApp = createAppInstance({ dependencies: testDependencies });

    // Create Sender User
    const senderHashedPassword = await hashPassword(senderPassword);
    const senderEmail = `test-sender-${Date.now()}@integration.com`;
    const senderInsert: Insertable<AuthUser> = { email: senderEmail, username: `sender-${Date.now()}`, password_hash: senderHashedPassword, email_verified: true };
    senderUser = await testDb.insertInto('auth.users').values(senderInsert).returningAll().executeTakeFirstOrThrow() as UserDTO;

    // Create Receiver User
    const receiverHashedPassword = await hashPassword(receiverPassword);
    const receiverEmail = `test-receiver-${Date.now()}@integration.com`;
    const receiverInsert: Insertable<AuthUser> = { email: receiverEmail, username: `receiver-${Date.now()}`, password_hash: receiverHashedPassword, email_verified: true };
    receiverUser = await testDb.insertInto('auth.users').values(receiverInsert).returningAll().executeTakeFirstOrThrow() as UserDTO;


    // Log in sender
    senderSessionCookie = await loginUser(senderUser.email, senderPassword);

    // Create Org using sender
    testOrg = await createTestOrg(`Two User Invite Org ${Date.now()}`);
  });

  afterAll(async () => {
    if (testDb) {
      try {
        // Clean invitations first (less likely to have FK constraints)
        await testDb.deleteFrom('organizations.invitations').where('organization_id', '=', testOrg.id).execute().catch(e => console.warn("Cleanup: Couldn't delete invitations:", e.message));
        if (testInvitation) {
          await testDb.deleteFrom('organizations.invitations').where('id', '=', testInvitation.id).execute().catch(e => console.warn("Cleanup: Couldn't delete specific test invitation:", e.message));
        }

        // Clean memberships
        await testDb.deleteFrom('organizations.memberships').where('organization_id', '=', testOrg.id).execute().catch(e => console.warn("Cleanup: Couldn't delete memberships:", e.message));

        // Clean organization
        await testDb.deleteFrom('organizations.organizations').where('id', '=', testOrg.id).execute().catch(e => console.warn("Cleanup: Couldn't delete organization:", e.message));

        // Clean users
        if (senderUser) await testDb.deleteFrom('auth.users').where('id', '=', senderUser.id).execute().catch(e => console.warn("Cleanup: Couldn't delete sender user:", e.message));
        if (receiverUser) await testDb.deleteFrom('auth.users').where('id', '=', receiverUser.id).execute().catch(e => console.warn("Cleanup: Couldn't delete receiver user:", e.message));

      } catch (error) {
        console.error(`[organization-invitation.integration.test] Error during cleanup:`, error);
      } finally {
        await testDb.destroy();
        // console.log('DB connection closed.');
      }
    } else {
      // console.log('No DB connection to close.');
    }
  });

  afterEach(async () => {
    // Clean up the specific invitation created for the test
    if (testInvitation) {
      await testDb.deleteFrom('organizations.invitations')
        .where('id', '=', testInvitation.id)
        .execute()
        .catch(e => console.warn("Cleanup (afterEach): Couldn't delete specific test invitation:", e.message));
      testInvitation = null; // Reset for the next test
    }
    // Clean up any potential membership for the receiver in the test org
    // This prevents the /accept test from leaving state for the /decline test
    await testDb.deleteFrom('organizations.memberships')
      .where('organization_id', '=', testOrg.id)
      .where('user_id', '=', receiverUser.id)
      .execute()
      .catch(e => console.warn("Cleanup (afterEach): Couldn't delete receiver membership:", e.message));
  });

  beforeEach(() => {
    mockSendEmail.mockClear();
    // testInvitation is now reset in afterEach, no need to null it here
  });

  // --- Test Cases ---

  describe('POST /api/v1/organizations/:organizationId/invitations', () => {
    it('should create a new invitation successfully (sender invites receiver)', async () => {
      // Use testApp (via helper createTestInvite implicitly)
      const res = await testApp.request(`/api/v1/organizations/${testOrg.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': senderSessionCookie }, // Sender's cookie
        body: JSON.stringify({ email: receiverUser.email }), // Inviting receiver
      });
      expect(res.status).toBe(201);
      const { createdInvitation } = await res.json() as CreateOrganizationInvitationResponseDTO;

      expect(createdInvitation).toBeDefined();
      expect(createdInvitation.organization_id).toBe(testOrg.id);
      expect(createdInvitation.invited_by_user_id).toBe(senderUser.id); // Invited by sender
      expect(createdInvitation.email).toBe(receiverUser.email); // Email matches receiver
      expect(createdInvitation.status).toBe('pending');
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ email: receiverUser.email }));

      // Verify in DB
      const dbInviteResult = await testDb.selectFrom('organizations.invitations').where('id', '=', createdInvitation.id).selectAll().executeTakeFirst();
      expect(dbInviteResult).toBeDefined();
      expect(dbInviteResult?.status).toBe('pending');
      testInvitation = dbInviteResult ?? null;
    });

    it('should return 401 Unauthorized without session', async () => {
      // Use testApp
      const res = await testApp.request(`/api/v1/organizations/${testOrg.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // No cookie
        body: JSON.stringify({ email: receiverUser.email }),
      });
      expect(res.status).toBe(401);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    // Add test for non-member trying to invite if needed (would require a third user/org)
  });

  describe('POST /api/v1/organization-invitations/:token/accept', () => {
    beforeEach(async () => {
      // Sender creates an invitation for the receiver
      testInvitation = await createTestInvite(testOrg.id, receiverUser.email);
      expect(testInvitation.status).toBe('pending');
    });

    it('should accept a pending invitation successfully (receiver accepts)', async () => {
      expect(testInvitation).toBeDefined();
      // Receiver logs in
      const receiverSessionCookie = await loginUser(receiverUser.email, receiverPassword);

      // Receiver accepts the invitation
      const res = await testApp.request(`/api/v1/organization-invitations/${testInvitation!.token}/accept`, {
        method: 'POST',
        headers: { 'Cookie': receiverSessionCookie }, // Use Receiver's cookie
      });
      expect(res.status).toBe(201);
      const { invitation: accepted } = await res.json() as { invitation: Selectable<OrganizationsInvitation> };

      expect(accepted).toBeDefined();
      expect(accepted.id).toBe(testInvitation!.id);
      expect(accepted.status).toBe('accepted');

      // Verify invitation status in DB
      const dbInvite = await testDb.selectFrom('organizations.invitations').where('id', '=', testInvitation!.id).selectAll().executeTakeFirst();
      expect(dbInvite?.status).toBe('accepted');

      // Verify receiver's membership was created
      const dbMembership = await testDb.selectFrom('organizations.memberships')
        .where('organization_id', '=', testInvitation!.organization_id)
        .where('user_id', '=', receiverUser.id) // Check for RECEIVER's membership
        .selectAll().executeTakeFirst();
      expect(dbMembership).toBeDefined();
      expect(dbMembership?.role).toBe(testInvitation!.role); // Should match role from invite
      expect(dbMembership?.user_id).toBe(receiverUser.id);
    });

    it('should return 401 Unauthorized without session', async () => {
      expect(testInvitation).toBeDefined();
      const res = await testApp.request(`/api/v1/organization-invitations/${testInvitation!.token}/accept`, {
        method: 'POST', // No Cookie header
      });
      expect(res.status).toBe(401);
      const dbInvite = await testDb.selectFrom('organizations.invitations').where('id', '=', testInvitation!.id).select('status').executeTakeFirst();
      expect(dbInvite?.status).toBe('pending'); // Status should not change
    });

    it('should return 404 Not Found for invalid token (using receiver session)', async () => {
      const invalidToken = 'invalid-token-accept-two-user';
      const receiverSessionCookie = await loginUser(receiverUser.email, receiverPassword);
      const res = await testApp.request(`/api/v1/organization-invitations/${invalidToken}/accept`, {
        method: 'POST',
        headers: { 'Cookie': receiverSessionCookie },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/organization-invitations/:token/decline', () => {
    beforeEach(async () => {
      testInvitation = await createTestInvite(testOrg.id, receiverUser.email);
      expect(testInvitation.status).toBe('pending');
    });

    it('should decline a pending invitation successfully (receiver declines)', async () => {
      expect(testInvitation).toBeDefined();
      // Receiver logs in
      const receiverSessionCookie = await loginUser(receiverUser.email, receiverPassword);

      // Receiver declines the invitation
      const res = await testApp.request(`/api/v1/organization-invitations/${testInvitation!.token}/decline`, {
        method: 'POST',
        headers: { 'Cookie': receiverSessionCookie }, // Use Receiver's cookie
      });
      expect(res.status).toBe(201);
      const { invitation: declined } = await res.json() as { invitation: Selectable<OrganizationsInvitation> };

      expect(declined.id).toBe(testInvitation!.id);
      expect(declined.status).toBe('declined');

      // Verify invitation status in DB
      const dbInvite = await testDb.selectFrom('organizations.invitations').where('id', '=', testInvitation!.id).selectAll().executeTakeFirst();
      expect(dbInvite?.status).toBe('declined');

      // Verify receiver's membership was NOT created
      const dbMembership = await testDb.selectFrom('organizations.memberships')
        .where('organization_id', '=', testInvitation!.organization_id)
        .where('user_id', '=', receiverUser.id) // Check for RECEIVER's membership
        .selectAll().executeTakeFirst();
      expect(dbMembership).toBeUndefined();
    });

    it('should return 401 Unauthorized without session', async () => {
      expect(testInvitation).toBeDefined();
      const res = await testApp.request(`/api/v1/organization-invitations/${testInvitation!.token}/decline`, {
        method: 'POST', // No Cookie header
      });
      expect(res.status).toBe(401);
      const dbInvite = await testDb.selectFrom('organizations.invitations').where('id', '=', testInvitation!.id).select('status').executeTakeFirst();
      expect(dbInvite?.status).toBe('pending'); // Status should not change
    });

    it('should return 404 Not Found for invalid token (using receiver session)', async () => {
      const invalidToken = 'invalid-token-decline-two-user';
      const receiverSessionCookie = await loginUser(receiverUser.email, receiverPassword);
      const res = await testApp.request(`/api/v1/organization-invitations/${invalidToken}/decline`, {
        method: 'POST',
        headers: { 'Cookie': receiverSessionCookie },
      });
      expect(res.status).toBe(404);
    });
  });
});