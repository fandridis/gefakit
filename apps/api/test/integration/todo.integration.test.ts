import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createAppInstance, AppConfig, AppVariables } from '../../src/create-app';
import { Hono } from 'hono';
import { Bindings } from '../../src/types/hono';
import { Kysely, Selectable } from 'kysely';
import { DB } from '../../src/db/db-types';
import { Insertable } from 'kysely';
import { AuthUser, CoreTodo } from '../../src/db/db-types';
import { NeonDialect } from 'kysely-neon';
import { hashPassword } from '../../src/lib/crypto';
import { UserDTO } from '@gefakit/shared';
import { envConfig } from '../../src/lib/env-config';
import { getDb } from '../../src/lib/db'; // Import the new getDb function

// Import service/repo factories
import { createTodoRepository } from '../../src/features/todos/todo.repository';
import { createTodoService } from '../../src/features/todos/todo.service';
import { getTodoService } from '../../src/utils/get-service';
// --- Test Suite Setup ---
describe('Todo API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let testUser: Selectable<AuthUser> | undefined;
  let testApp: Hono<{ Bindings: Bindings, Variables: AppVariables }>;

  let sessionCookie: string;

  beforeAll(async () => {
    const dbUrl = envConfig.TEST_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("TEST_DATABASE_URL environment variable not set.");
    }

    // Use the getDb function to create the Kysely instance for tests
    testDb = getDb({ connectionString: dbUrl, useHyperdrive: true });

    // Instantiate dependencies for testing
    const testTodoRepository = createTodoRepository({ db: testDb });
    const testTodoService = createTodoService({ todoRepository: testTodoRepository });

    // Assemble dependencies
    const testDependencies: Partial<AppVariables> = {
      db: testDb, // Inject testDb
      todoService: testTodoService, // Inject real service using testDb
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
    // Clean up resources created *during* the test (e.g., todos)
    if (testDb && testUser) {
      try {
        // Delete ALL todos associated with the test user after EACH test
        // This ensures tests don't interfere with each other via todos
        const deleteResult = await testDb.deleteFrom('core.todos')
          .where('author_id', '=', testUser.id)
          .execute();
        // Log the number of deleted rows for debugging if needed
      } catch (error) {
        console.error(`Error cleaning up todos for user ${testUser.email}:`, error);
      }
    } else {
      // console.log("Skipping test cleanup: testDb or testUser not available.");
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

      // fetch all todos to use what exists already, log that
      const todos = await testDb.selectFrom('core.todos')
        .selectAll()
        .execute();

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

      // Assert: Check that no todo was created in the database
      const countResult = await testDb.selectFrom('core.todos')
        .select(({ fn }) => [fn.count('id').as('count')])
        .executeTakeFirst();

      expect(countResult?.count).toBe("0");
    });
  });
}); 