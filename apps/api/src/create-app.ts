import { Hono } from 'hono';
import { Bindings } from './types/hono';
import { ZodError } from 'zod';
import { ApiError, SessionDTO, UserDTO } from '@gefakit/shared';
import { authMiddleware } from './middleware/auth';
import { createOrganizationRoutesV1 } from './features/organizations/organization.routes.v1';
import { createOrganizationInvitationRoutesV1 } from './features/organization-invitations/organization-invitation.routes.v1';
import { impersonationLogMiddleware } from './middleware/impersonation-log';
import { kvTokenBucketRateLimiter } from './middleware/rate-limiter';
import { securityHeaders } from './middleware/security-headers';
import { logger } from 'hono/logger';
import { Kysely } from 'kysely';
import { DB } from './db/db-types';
import { createAuthRoutesV1 } from './features/auth/auth.routes.v1';
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
import { AdminService } from './features/admin/admin.service';
import { UserService } from './features/users/user.service';
import { OnboardingService } from './features/onboarding/onboarding.service';
import { createUserRoutesV1 } from './features/users/user.routes.v1';
import { createOrganizationMembershipRoutesV1 } from './features/organization-memberships/organization-membership.routes.v1';

export interface AppConfig {
  dependencies?: Partial<AppVariables>;
}
/**
 * Define the full set of variables that are available to the app context.
 * We defined them as optional if they are only available in certain contexts.
 * And we use getOrThrow style of utility functions to access them.
 */
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
    console.log('===== /api/* CORS headers =====')
    console.log('process.env.APP_URL', process.env.APP_URL)
    const origin = process.env.APP_URL || 'http://localhost:5173';
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

  /** Add a health check route */
  app.get('/api/health', (c) => {
    return c.json({ ok: true, message: 'prod 12' });
  });

  // Apply services middleware - has to be after db middleware
  const { db, ...otherServices } = config?.dependencies ?? {};
  app.use('/api/*', servicesMiddleware(otherServices));

  // Apply rate limiting AFTER dependencies might be needed (e.g., for key generation)
  // As we could have in dependancies a "crypto utils" that needs to be initialized
  app.use('/api/*', kvTokenBucketRateLimiter({
    kvBindingName: 'GEFAKIT_RATE_LIMITER_KV',
    maxTokens: 60,
    refillRatePerSecond: 1,
    kvExpirationTtl: 3600,
    keyGenerator: (c) => `app-rate-limit:${c.req.header('cf-connecting-ip') || 'unknown'}`
  }));

  // Apply security headers
  app.use('/api/*', securityHeaders);

  /**
   * ROUTES GO HERE
   * Note that private routes are mounted after the auth middleware
   */
  // Public routes
  app.route("/api/v1/auth", createAuthRoutesV1());

  // Private routes
  app.use("/api/v1/*", authMiddleware(), impersonationLogMiddleware);
  app.route('/api/v1/admin', createAdminRoutesV1());
  app.route("/api/v1/users", createUserRoutesV1());
  app.route("/api/v1/todos", createTodoRoutesV1());
  app.route("/api/v1/organizations", createOrganizationRoutesV1());
  app.route("/api/v1/organization-memberships", createOrganizationMembershipRoutesV1());
  app.route("/api/v1/organization-invitations", createOrganizationInvitationRoutesV1());

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