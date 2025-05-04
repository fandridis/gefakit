import { Hono, Next } from 'hono';
import { Context } from 'hono';
import { Bindings } from './types/hono';
import { ZodError } from 'zod';
import { ApiError } from '@gefakit/shared';
import { authMiddleware } from './middleware/auth';
import { organizationRoutesV1 } from './features/organizations/organization.routes.v1';
import { organizationMembershipRoutesV1 } from './features/organization-memberships/organization-membership.routes.v1';
import { organizationInvitationRoutesV1 } from './features/organization-invitations/organization-invitation.routes.v1';
import { adminRoutesV1 } from './features/admin/admin.routes.v1';
import { impersonationLogMiddleware } from './middleware/impersonation-log';
import { kvTokenBucketRateLimiter } from './middleware/rate-limiter';
import { envConfig } from './lib/env-config';
import { securityHeaders } from './middleware/security-headers';
import { logger } from 'hono/logger';
import { userRoutesV1 } from './features/users/user.routes.v1';
import { Kysely } from 'kysely';
import { DB } from './db/db-types';
import { authRoutesV1 } from './features/auth/auth.routes.v1';
import { todoRoutesV1 } from './features/todos/todo.routes.v1';
import { NeonDialect } from 'kysely-neon';
import { TodoService } from './features/todos/todo.service';

// Define the full set of dependencies needed by the app
// We'll add more services/repos here as we refactor
export interface AppDependencies {
  db: Kysely<DB>; // Keep DB separate if creating per-request, or include if injected
  todoService: TodoService;
}

// Define the context variable shape - combining DB and future dependencies
// Make specific dependencies optional if they aren't available on all routes/middlewares
export type AppVariables = {
  db: Kysely<DB>; // db should generally always be available after middleware
  todoService?: TodoService; // Make optional if not guaranteed on every context
}

// Configuration for creating the app instance
export interface AppConfig {
  // Use Partial<> to allow injecting only some dependencies, e.g., during testing
  dependencies?: Partial<AppDependencies>;
}

/**
 * Middleware to set dependencies onto the context
 * For now db is the only real dependency set here.
 * But some "always needed" services could be set here too.
 * 
 * Testing will use this heavily to inject mocks.
 */
const setDependenciesMiddleware = (dependencies: Partial<AppDependencies>) => {
  return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    let dbToSet: Kysely<DB>;

    // Handle DB setup: If a DB is provided, use it. Otherwise, create a new one.
    if (dependencies?.db) {
      dbToSet = dependencies.db;
    } else {
      // Create per-request DB (production) - Ensure env var is checked safely
      if (!envConfig.DATABASE_URL_POOLED) {
        console.error('DATABASE_URL_POOLED is not defined in the environment');
        // Consider returning a 500 error response instead of throwing immediately
        // throw new Error('Database configuration error.');
         return c.json({ ok: false, error: "Internal configuration error" }, 500);
      }
      const dialect = new NeonDialect({ connectionString: envConfig.DATABASE_URL_POOLED });
      dbToSet = new Kysely<DB>({ dialect });
    }
    c.set('db', dbToSet); 

    // Set other provided dependencies if they exist in the config
    // We are setting the todoService here as an example.
    if (dependencies?.todoService) {
      c.set('todoService', dependencies.todoService);
    }
    // ... set other dependencies as they are added ...

    await next();
  };
};

// Modify createAppInstance to accept optional AppConfig and use AppVariables
export function createAppInstance(config?: AppConfig): Hono<{ Bindings: Bindings, Variables: AppVariables }> {
  // Initialize Hono with the correct Variables type
  const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>();

  // Apply CORS headers
  app.use('/api/*', async (c, next) => {
    const origin = envConfig.APP_URL || 'http://localhost:5173';
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Allow-Methods', 'GET, PATCH, POST, PUT, DELETE, OPTIONS');

    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, PATCH, POST, PUT, DELETE, OPTIONS',
        },
      });
    }
    await next();
  });

  // Log all requests
  app.use(logger());

  // Apply dependency injection middleware globally or scoped as needed
  // Pass only the dependencies object if it exists, otherwise an empty object
  app.use('/api/*', setDependenciesMiddleware(config?.dependencies ?? {}));

  // Apply rate limiting AFTER dependencies might be needed (e.g., for key generation)
  // Requires GEFAKIT_RATE_LIMITER_KV binding
  app.use('/api/*', kvTokenBucketRateLimiter({
    kvBindingName: 'GEFAKIT_RATE_LIMITER_KV',
    maxTokens: 60,
    refillRatePerSecond: 1,
    kvExpirationTtl: 3600,
    keyGenerator: (c) => `app-rate-limit:${c.req.header('cf-connecting-ip') || 'unknown'}` // Ensure fallback
  }));

  // Apply security headers
  app.use('/api/*', securityHeaders);

  // Impersonation log middleware (applies after auth potentially modifies state)
  // Ensure it has access to needed variables if refactored
  app.use('/api/*', impersonationLogMiddleware);

  // --- Mount Routes ---

  // Admin routes
  app.route('/api/v1/admin', adminRoutesV1);

  // Auth routes
  app.route("/api/v1/auth", authRoutesV1);

  // User routes (Require auth)
  // Ensure authMiddleware is compatible with AppVariables if it sets user/session
  app.use("/api/v1/users/*", authMiddleware);
  app.route("/api/v1/users", userRoutesV1);

  // Todo routes (Require auth)
  app.use("/api/v1/todos/*", authMiddleware);
  app.route("/api/v1/todos", todoRoutesV1);

  // Organization routes (Require auth)
  app.use("/api/v1/organizations/*", authMiddleware);
  app.route("/api/v1/organizations", organizationRoutesV1);

  // Organization membership routes (Require auth)
  app.use("/api/v1/organization-memberships/*", authMiddleware);
  app.route("/api/v1/organization-memberships", organizationMembershipRoutesV1);

  // Organization invitation routes (Require auth)
  app.use("/api/v1/organization-invitations/*", authMiddleware);
  app.route("/api/v1/organization-invitations", organizationInvitationRoutesV1);

  // --- Error Handling & Not Found ---

  app.notFound((c) => {
    return c.text('This route does not exist', 404);
  });

  // Ensure onError handler has access to context if needed, though it usually just gets the error
  app.onError((err, c) => {
    console.error('App Error:', err); // Log the full error

    if (err instanceof ZodError) {
      console.log('IT IS A ZOD ERROR (direct)');
      return c.json({
        ok: false,
        errors: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, 400);
    }

    if (err instanceof Error && err.cause instanceof ZodError) {
      console.log('IT IS A ZOD ERROR (wrapped in HTTPException)');
      const zodError = err.cause;
      return c.json({
        ok: false,
        errors: zodError.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, 400);
    }

    if (err instanceof ApiError) {
      console.log('IT IS A API ERROR: ', err);
      const statusCode = typeof err.status === 'number' && err.status >= 100 && err.status <= 599
        ? err.status
        : 500;
      return c.json({
        ok: false,
        name: err.name,
        message: err.message,
        details: err.details
      }, statusCode as any);
    }

    return c.json({ ok: false, error: "Internal Server Error" }, 500);
  });

  return app;
} 