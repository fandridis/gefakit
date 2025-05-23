import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createAppInstance, AppVariables } from '../../src/create-app';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely, Selectable } from 'kysely';
import { DB, AuthUser } from '../../src/db/db-types';
import { Insertable } from 'kysely';
import { CoreTodo } from '../../src/db/db-types';
import { hashPassword } from '../../src/lib/crypto';
import { getDb } from '../../src/lib/db'; // Import the new getDb function
import Stripe from 'stripe'; // Added Stripe import
import { UserDTO } from '@gefakit/shared'; // Keep UserDTO as it's likely used

// Import service/repo factories
import { createTodoRepository } from '../../src/features/todos/todo.repository';
import { createTodoService } from '../../src/features/todos/todo.service';

// Define mockStripeInstance
const mockStripeInstance = {
  charges: {
    create: vi.fn().mockResolvedValue({ id: 'ch_test_mock_todo', status: 'succeeded' }),
  },
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test_mock_todo' }),
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: 'pi_test_mock_todo', client_secret: 'pi_todo_secret', status: 'requires_payment_method' }),
  },
  setupIntents: {
    create: vi.fn().mockResolvedValue({ id: 'seti_test_mock_todo', client_secret: 'seti_todo_secret', status: 'requires_payment_method' }),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue({ id: 'sub_test_mock_todo', status: 'active' }),
  },
} as unknown as Stripe;

// --- Test Suite Setup ---
describe('Todo API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let testUser: UserDTO | undefined;
  let sessionCookie: string;
  let testApp: Hono<{ Bindings: Bindings, Variables: AppVariables }>;

  beforeAll(async () => {
    console.log('================ todo.integration.test.ts =================')
    console.log('WITH NODE_ENV: ', process.env.NODE_ENV)
    console.log('WITH TEST_DATABASE_URL: ', process.env.TEST_DATABASE_URL)
    const dbUrl = process.env.TEST_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("TEST_DATABASE_URL environment variable not set.");
    }

    // Use the getDb function to create the Kysely instance for tests
    testDb = getDb({ connectionString: dbUrl, useHyperdrive: false });

    // Instantiate dependencies for testing
    const testTodoRepository = createTodoRepository({ db: testDb });
    const testTodoService = createTodoService({ todoRepository: testTodoRepository });

    // Assemble dependencies
    const testDependencies: Partial<AppVariables> = {
      db: testDb, // Inject testDb
      todoService: testTodoService, // Inject real service using testDb
      stripe: mockStripeInstance, // Pass the mock Stripe instance
    };

    // Create app instance with injected dependencies
    testApp = createAppInstance({ dependencies: testDependencies });

    const testPassword = 'password1234';
    const hashedPassword = await hashPassword(testPassword);
    const userEmail = `testuser-${Date.now()}@integration.com`;
    const userInsert: Insertable<AuthUser> = {
      email: userEmail,
      username: `testuser-${Date.now()}`,
      password_hash: hashedPassword,
      email_verified: true
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
        await testDb.deleteFrom('auth.users')
          .where('id', '=', testUser.id)
          .execute();
      } catch (error) {
        console.error(`Error deleting user ${testUser.email}:`, error);
      }
    }

    if (testDb) {
      await testDb.destroy();
      // console.log('Test database connection closed.');
    } else {
      // console.log('No test database connection to close.');
    }
  });

  // --- Per-Test Setup/Teardown ---
  beforeEach(async () => {
    // Now primarily for setting up test-specific data *if needed*.
    // We no longer create the user here.
    // Example: If a GET test needs a pre-existing todo, create it here.
    // console.log(`Starting test case... (User: ${testUser?.email})`);
  });

  afterEach(async () => {
    if (testDb && testUser) {
      try {
        if (typeof testUser.id === 'undefined' || testUser.id === null) {
          // console.error(`[afterEach] Invalid testUser.id: ${testUser.id}. Skipping delete for user ${testUser.email}.`);
          return;
        }

        // console.log(`[afterEach] Attempting to delete todos for user ID: ${testUser.id} (type: ${typeof testUser.id})`);
        const deleteResult = await testDb.deleteFrom('core.todos')
          .where('author_id', '=', testUser.id)
          .execute();

      } catch (error) {
        console.error(`[afterEach] Error cleaning up todos for user ${testUser.email}:`, error); // Keep this error log
      }
    } else {
      let reason = "testDb or testUser not available.";
      if (!testDb) reason = "testDb is not available.";
      else if (!testUser) reason = "testUser is not available.";
      // console.log(`[afterEach] Skipping cleanup: ${reason}`);
    }
  });

  describe('POST /api/v1/todos', () => {
    it('should create a new todo for the authenticated user', async () => {
      const newTodoData = {
        title: 'Integration Test Todo',
        description: 'Integration Test Description',
        completed: false,
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const res = await testApp.request('/api/v1/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(newTodoData),
      });

      expect(res.status).toBe(200);
      const { createdTodo } = await res.json() as { createdTodo: CoreTodo };
      expect(createdTodo).toBeDefined();
      expect(createdTodo.id).toBeTypeOf('number');
      expect(createdTodo.title).toBe(newTodoData.title);
      expect(createdTodo.completed).toBe(newTodoData.completed);
      expect(createdTodo.author_id).toBe(testUser!.id);

      const dbTodo = await testDb.selectFrom('core.todos')
        .where('id', '=', Number(createdTodo.id))
        .selectAll()
        .executeTakeFirst();

      expect(dbTodo).toBeDefined();
      expect(dbTodo?.title).toBe(newTodoData.title);
      expect(dbTodo?.completed).toBe(newTodoData.completed);
      expect(dbTodo?.author_id).toBe(testUser!.id);
    });

    it('should return 401 Unauthorized if no session cookie is provided', async () => {
      const newTodoData = { title: 'Unauthorized Test Todo', completed: false };

      const res = await testApp.request('/api/v1/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // No Cookie header
        body: JSON.stringify(newTodoData),
      });

      expect(res.status).toBe(401); // Expecting Hono's default or auth middleware's response
    });


    it('should return 400 Bad Request if request body is invalid', async () => {
      const invalidTodoData = { completed: 'yes' }; // Invalid types

      const res = await testApp.request('/api/v1/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify(invalidTodoData),
      });

      expect(res.status).toBe(400);

      const body = await res.json() as any;

      expect(body.ok).toBe(false);
      expect(body.errors).toBeInstanceOf(Array);

      // Check for specific validation errors if needed
      expect(body.errors.some((e: any) => e.field === 'title')).toBe(true);
      expect(body.errors.some((e: any) => e.field === 'completed')).toBe(true);

      // Assert: Check that no todo was created in the database for the current user
      const userTodoCountResult = await testDb.selectFrom('core.todos')
        .where('author_id', '=', testUser!.id)
        .select(({ fn }) => [fn.count('id').as('count')
        ])
        .executeTakeFirst();
      expect(userTodoCountResult?.count).toBe("0");

      // Optional: Keep the overall count check if it's truly desired, but it might be flaky
      // due to parallel tests or other suite residues if not perfectly isolated.
      // For now, focusing on user-specific count.
      // const overallCountResult = await testDb.selectFrom('core.todos')
      //   .select(({ fn }) => [fn.count('id').as('count')])
      //   .executeTakeFirst();
      // expect(overallCountResult?.count).toBe("0");
    });
  });
}); 