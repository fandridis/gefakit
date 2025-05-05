import { Hono } from 'hono';
import { Bindings } from './types/hono';
import { ZodError } from 'zod';
import { ApiError, SessionDTO, UserDTO } from '@gefakit/shared';
import { authMiddleware } from './middleware/auth';
import { createOrganizationRoutesV1 } from './features/organizations/organization.routes.v1';
import { organizationMembershipRoutesV1 } from './features/organization-memberships/organization-membership.routes.v1';
import { organizationInvitationRoutesV1 } from './features/organization-invitations/organization-invitation.routes.v1';
import { impersonationLogMiddleware } from './middleware/impersonation-log';
import { kvTokenBucketRateLimiter } from './middleware/rate-limiter';
import { envConfig } from './lib/env-config';
import { securityHeaders } from './middleware/security-headers';
import { logger } from 'hono/logger';
import { userRoutesV1 } from './features/users/user.routes.v1';
import { Kysely } from 'kysely';
import { AuthUser, DB } from './db/db-types';
import { authRoutesV1 } from './features/auth/auth.routes.v1';
import { TodoService } from './features/todos/todo.service';
import { createAdminRoutesV1 } from './features/admin/admin.routes.v1';
import { createTodoRoutesV1 } from './features/todos/todo.routes.v1';
import { dbMiddleware } from './middleware/db';
import { servicesMiddleware } from './middleware/services';
import { OrganizationService } from './features/organizations/organization.service';
import { OrganizationInvitationService } from './features/organization-invitations/organization-invitation.service';
import { OrganizationMembershipService } from './features/organization-memberships/organization-membership.service';
import { AuthService } from './features/auth/auth.service';
import { EmailService } from './features/emails/email.service';
import { OrganizationMembershipRepository } from './features/organization-memberships/organization-membership.repository';
import { UserRepository } from './features/users/user.repository';
import { OrganizationInvitationRepository } from './features/organization-invitations/organization-invitation.repository';
import { AuthRepository } from './features/auth/auth.repository';
import { AdminService } from './features/admin/admin.service';
import { UserService } from './features/users/user.service';
import { OnboardingService } from './features/onboarding/onboarding.service';

/**
 * Single kysely instance created once on cold start of the worker.
 * 
 * TODO: This doesn't work. We either need to use 
 * 
 * 
 */

// console.log('======== SETTING UP DB SINGLETON ========')
// const dbSingleton = new Kysely<DB>({
//   dialect: new NeonDialect({
//     connectionString: envConfig.DATABASE_URL_POOLED,
//   }),
//   plugins: [new ParseJSONResultsPlugin()],
// })

// Configuration for creating the app instance
export interface AppConfig {
  // Use Partial<> to allow injecting only some dependencies, e.g., during testing
  dependencies?: Partial<AppVariables>;
}

// Define the full set of dependencies needed by the app
// We'll add more services/repos here as we refactor
export interface AppVariables {
  /** DB  */
  db: Kysely<DB>;
  /** Auth */
  user?: UserDTO;
  session?: SessionDTO;
  /** Services */
  todoService?: TodoService;
  organizationService?: OrganizationService;
  organizationInvitationService?: OrganizationInvitationService;
  organizationMembershipService?: OrganizationMembershipService;
  authService?: AuthService;
  emailService?: EmailService;
  userService?: UserService;
  adminService?: AdminService;
  onboardingService?: OnboardingService;
  /** Misc */
  impersonatorUserId?: number;
}

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

  // Apply db middleware
  app.use('/api/*', dbMiddleware(config?.dependencies?.db));

  // Apply services middleware - has to be after db middleware
  const { db, ...otherServices } = config?.dependencies ?? {};
  app.use('/api/*', servicesMiddleware(otherServices));

  // Apply rate limiting AFTER dependencies might be needed (e.g., for key generation)
  // As we could have in dependancies a "crypto utils" that needs to be initialized
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
  app.route('/api/v1/admin', createAdminRoutesV1());

  // Auth routes
  app.route("/api/v1/auth", authRoutesV1);

  // User routes (Require auth)
  // Ensure authMiddleware is compatible with AppVariables if it sets user/session
  app.use("/api/v1/users/*", authMiddleware());
  app.route("/api/v1/users", userRoutesV1);

  // Todo routes (Require auth)
  app.use("/api/v1/todos/*", authMiddleware());
  app.route("/api/v1/todos", createTodoRoutesV1());

  // Organization routes (Require auth)
  app.use("/api/v1/organizations/*", authMiddleware());
  app.route("/api/v1/organizations", createOrganizationRoutesV1());

  // Organization membership routes (Require auth)
  app.use("/api/v1/organization-memberships/*", authMiddleware());
  app.route("/api/v1/organization-memberships", organizationMembershipRoutesV1);

  // Organization invitation routes (Require auth)
  app.use("/api/v1/organization-invitations/*", authMiddleware());
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