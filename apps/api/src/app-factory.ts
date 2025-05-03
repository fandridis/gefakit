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
import { DbMiddleWareVariables } from './middleware/db'; // Import the variable type
import { authRoutesV1 } from './features/auth/auth.routes.v1';
import { todoRoutesV1 } from './features/todos/todo.routes.v1';

// Define the configuration shape for the app instance
export interface AppConfig {
  db: Kysely<DB>;
  // Add other injectable dependencies here if needed later (e.g., MailerService, Logger)
}

// Middleware to set the provided DB instance onto the context
const setDbMiddleware = (db: Kysely<DB>) => {
  return async (c: Context<{ Variables: DbMiddleWareVariables }>, next: Next) => {
    c.set('db', db);
    await next();
  };
};

export function createAppInstance(config: AppConfig): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();

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

  // All routes will have access to the db instance via context set by this middleware.
  // Use the *provided* db instance from the config
  app.use('/api/*', setDbMiddleware(config.db));

  // Apply generic rate limiting to all API routes after db setup
  // Requires GEFAKIT_RATE_LIMITER_KV binding in the environment
  app.use('/api/*', kvTokenBucketRateLimiter({
    kvBindingName: 'GEFAKIT_RATE_LIMITER_KV',
    maxTokens: 60,
    refillRatePerSecond: 1,
    kvExpirationTtl: 3600,
    keyGenerator: (c) => `app-rate-limit:${c.req.header('cf-connecting-ip')}`
  }));

  // Apply security headers to all API routes after rate limiting
  app.use('/api/*', securityHeaders);

  // Impersonation log middleware (applies after auth potentially modifies state)
  app.use('/api/*', impersonationLogMiddleware);

  // --- Mount Routes ---

  // Admin routes (Assuming admin routes have their own specific auth checks)
  app.route('/api/v1/admin', adminRoutesV1);

  // Auth routes (Public, no global auth middleware needed before them)
  app.route("/api/v1/auth", authRoutesV1);

  // User routes (Require auth)
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

  app.onError((err, c) => {
    console.log('====================================================');
    console.log('=                      onError                     =');
    console.log('====================================================');
    console.error('App Error:', err);


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