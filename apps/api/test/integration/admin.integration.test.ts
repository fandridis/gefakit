import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Hoist mock
const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn().mockResolvedValue(undefined) }));

// Mock EmailService
vi.mock('../../src/features/emails/email.service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({ sendOrganizationInvitationEmail: mockSendEmail })),
  createEmailService: vi.fn(() => ({ sendOrganizationInvitationEmail: mockSendEmail })),
}));

// Import factory and types
// import app from '../../src/index';
import { createAppInstance, CoreAppVariables } from '../../src/app-factory';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely, Insertable } from 'kysely';
import { DB, AuthUser } from '../../src/db/db-types';
import { NeonDialect } from 'kysely-neon';
import { hashPassword } from '../../src/lib/crypto';
import { UserDTO, OrganizationDTO, GetSessionResponseDTO } from '@gefakit/shared';
import { envConfig } from '../../src/lib/env-config';

describe('Admin API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let adminUser: UserDTO;
  let normalUser: UserDTO;
  let adminUserPassword = 'adminPassword123';
  let normalUserPassword = 'normalPassword456';
  let testOrg: OrganizationDTO;
  let adminUserSessionCookie: string;
  let normalUserSessionCookie: string;
  let testApp: Hono<{ Bindings: Bindings, Variables: CoreAppVariables }>; // Declare testApp

  // Helper to log in a user and return their session cookie
  const loginUser = async (email: string, password: string): Promise<string> => {
      // Use testApp for login
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

  beforeAll(async () => {
    const dbUrl = envConfig.DATABASE_URL_POOLED;
    if (!dbUrl) throw new Error("DATABASE_URL_POOLED not set.");
    testDb = new Kysely<DB>({ dialect: new NeonDialect({ connectionString: dbUrl }) });

    // Create test app instance
    const testDependencies: Partial<CoreAppVariables> = {
      db: testDb, // Inject testDb
    };
    testApp = createAppInstance({ dependencies: testDependencies });

    // Create Admin User
    const adminUserHashedPassword = await hashPassword(adminUserPassword);
    const adminUserEmail = `test-admin-${Date.now()}@integration.com`;
    const adminUserInsert: Insertable<AuthUser> = { email: adminUserEmail, username: `admin-${Date.now()}`, password_hash: adminUserHashedPassword, email_verified: true, role: 'ADMIN' };
    adminUser = await testDb.insertInto('auth.users').values(adminUserInsert).returningAll().executeTakeFirstOrThrow() as UserDTO;

     // Create Normal User
    const normalUserHashedPassword = await hashPassword(normalUserPassword);
    const normalUserEmail = `test-normal-${Date.now()}@integration.com`;
    const normalUserInsert: Insertable<AuthUser> = { email: normalUserEmail, username: `normal-${Date.now()}`, password_hash: normalUserHashedPassword, email_verified: true };
    normalUser = await testDb.insertInto('auth.users').values(normalUserInsert).returningAll().executeTakeFirstOrThrow() as UserDTO;

    // Log in admin user
    adminUserSessionCookie = await loginUser(adminUser.email, adminUserPassword);

  });

  afterAll(async () => {
    if (testDb) {
      try {
        // Clean users
        if (adminUser) await testDb.deleteFrom('auth.users').where('id', '=', adminUser.id).execute().catch(e => console.warn("Cleanup: Couldn't delete admin user:", e.message));
        if (normalUser) await testDb.deleteFrom('auth.users').where('id', '=', normalUser.id).execute().catch(e => console.warn("Cleanup: Couldn't delete normal user:", e.message));

      } catch (error) {
        console.error(`[admin.integration.test] Error during cleanup:`, error);
      } finally {
          await testDb.destroy();
          // console.log('DB connection closed.');
      }
    } else {
        // console.log('No DB connection to close.');
    }
  });

  // beforeEach(() => {});
  // afterEach(async () => {});

  describe('POST /api/v1/admin/impersonate', () => {
    it('should return 401 Unauthorized without session', async () => {
      // Use testApp
      const res = await testApp.request(`/api/v1/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // No cookie (no session)
        body: JSON.stringify({ email: normalUser.email }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request without targetUserId', async () => {
      // Use testApp
      const res = await testApp.request(`/api/v1/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminUserSessionCookie },
        body: JSON.stringify({}), // No targetUserId
      });
      expect(res.status).toBe(400);
    });

    it('should start and stop impersonation of a user successfully', async () => {
      // Use testApp
      const res = await testApp.request(`/api/v1/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminUserSessionCookie },
        body: JSON.stringify({ targetUserId: normalUser.id }),
      });
      expect(res.status).toBe(200);

      const { message } = await res.json() as { message: string };
      expect(message).toBeDefined();
      expect(message).toContain(`Admin ${adminUser.id} is now impersonating user ${normalUser.id}`);

      // Use testApp
      const sessionRes = await testApp.request(`/api/v1/auth/session`, {
        method: 'GET',
        headers: { 'Cookie': adminUserSessionCookie },
      });

      expect(sessionRes.status).toBe(200);
      const {session, user} =  await sessionRes.json() as GetSessionResponseDTO;
      expect(session?.id).toBeDefined();
      expect(session?.user_id).toBe(normalUser.id);
      expect(session?.impersonator_user_id).toBe(adminUser.id);
      expect(user?.id).toBe(normalUser.id);
      expect(user?.role).toBe('USER');

      // Stop impersonation - Use testApp
      const stopImpersonationRes = await testApp.request(`/api/v1/admin/stop-impersonation`, {
        method: 'POST',
        headers: { 'Cookie': adminUserSessionCookie },
      });
      expect(stopImpersonationRes.status).toBe(200);
      const { message: stopImpersonationMessage } = await stopImpersonationRes.json() as { message: string };
      expect(stopImpersonationMessage).toBeDefined();
      expect(stopImpersonationMessage).toContain('Impersonation stopped');

      // Get session again - Use testApp
      const sessionRes2 = await testApp.request(`/api/v1/auth/session`, {
        method: 'GET',
        headers: { 'Cookie': adminUserSessionCookie },
      });
      expect(sessionRes2.status).toBe(200);
      const {session: session2, user: user2} =  await sessionRes2.json() as GetSessionResponseDTO;
      expect(session2?.id).toBeDefined();
      expect(session2?.user_id).toBe(adminUser.id);
      expect(session2?.impersonator_user_id).toBeNull();
      expect(user2?.id).toBe(adminUser.id);
      expect(user2?.role).toBe('ADMIN');
    });
  });
}); 