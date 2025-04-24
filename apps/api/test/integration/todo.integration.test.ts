import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from '../../src/index';
import { Kysely } from 'kysely';
import { DB } from '../../src/db/db-types';
import { Insertable } from 'kysely';
import { AuthUser, CoreTodo } from '../../src/db/db-types';
import { NeonDialect } from 'kysely-neon';
import { hashPassword } from '../../src/lib/crypto';
import { UserDTO } from '@gefakit/shared';
import { envConfig } from '../../src/lib/env-config';
// vi.stubEnv('DATABASE_URL_POOLED', 'postgresql://neondb_owner:npg_v9IioTkZd6RY@ep-withered-heart-a2fk19ng-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require');

// --- Test Suite Setup ---
describe('Todo API Integration Tests', () => {
  let testDb: Kysely<DB>;
  let testUser: UserDTO | undefined;

  let sessionCookie: string;

  beforeAll(async () => {
    testDb = new Kysely<DB>({
      dialect: new NeonDialect({
        connectionString: envConfig.DATABASE_URL_POOLED,
      }),
    });

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

    console.log('gg1 testUser', testUser);

    const loginRes = await app.request('/api/v1/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: testPassword }),
    });

    console.log('gg2 testuser logged in: ', loginRes);

    expect(loginRes.status).toBe(200);
    const setCookieHeader = loginRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeDefined();
    if (!setCookieHeader) {
      throw new Error('Set-Cookie header not found in login response');
    }
    sessionCookie = setCookieHeader;
  });

  afterAll(async () => {
    console.log('Cleaning up test user and closing DB connection...');
    if (testDb && testUser) {
      try {
        await testDb.deleteFrom('auth.users')
          .where('id', '=', testUser.id)
          .execute();
        console.log(`Deleted user: ${testUser.email}`);
      } catch (error) {
        console.error(`Error deleting user ${testUser.email}:`, error);
      }
    }

    if (testDb) {
      await testDb.destroy();
      console.log('Test database connection closed.');
    } else {
      console.log('No test database connection to close.');
    }
  });

  // --- Per-Test Setup/Teardown ---
  beforeEach(async () => {
    // Now primarily for setting up test-specific data *if needed*.
    // We no longer create the user here.
    // Example: If a GET test needs a pre-existing todo, create it here.
    console.log(`Starting test case... (User: ${testUser?.email})`);
  });

  afterEach(async () => {
    // Clean up resources created *during* the test (e.g., todos)
    if (testDb && testUser) {
      try {
        // Delete ALL todos associated with the test user after EACH test
        // This ensures tests don't interfere with each other via todos
        const deleteResult = await testDb.deleteFrom('core.todos')
          .where('author_id', '=', testUser.id)
          .executeTakeFirst();
        console.log(`Cleaned up todos for user ${testUser.email}. Rows affected: ${deleteResult.numDeletedRows}`);
      } catch (error) {
          console.error(`Error cleaning up todos for user ${testUser.email}:`, error);
          // Decide if you want to throw or just log here
      }
    } else {
        console.warn("Skipping test cleanup: testDb or testUser not available.");
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

      const res = await app.request('/api/v1/todos', {
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

        const res = await app.request('/api/v1/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // No Cookie header
            body: JSON.stringify(newTodoData),
        });

        expect(res.status).toBe(401); // Expecting Hono's default or auth middleware's response
    });


    it('should return 400 Bad Request if request body is invalid', async () => {
      const invalidTodoData = { title: 123, completed: 'yes' }; // Invalid types

      const res = await app.request('/api/v1/todos', {
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