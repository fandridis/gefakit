import { Hono } from "hono";
import { Bindings } from "./types/hono";
import { dbMiddleware } from "./middleware/db";
import { authRoutesV1 } from "./features/auth/auth.routes.v1";
import { ZodError } from "zod";
import { AppError } from "./core/app-error";
import { todoRoutesV1 } from "./features/todos/todo.routes.v1";
import { authMiddleware } from "./middleware/auth";
import { organizationsRoutesV1 } from "./features/organizations/organization.routes.v1";
import { userRoutesV1 } from "./features/users/user.routes.v1";
import { organizationMembershipRoutesV1 } from "./features/organization-memberships/organization-membership.routes.v1";
import { organizationInvitationRoutesV1 } from "./features/organization-invitations/organization-invitation.routes.v1";
import {adminRoutesV1} from "./features/admin/admin.routes.v1";
import { impersonationLogMiddleware } from "./middleware/impersonation-log";
import { kvTokenBucketRateLimiter } from "./middleware/rate-limiter";
import { envConfig } from "./lib/env-config";
import { securityHeaders } from "./middleware/security-headers";
import { logger } from "hono/logger";

const app = new Hono<{ Bindings: Bindings}>();

// Generic rate limiter - apply to all API routes as a baseline
const genericRateLimiter = kvTokenBucketRateLimiter({
  kvBindingName: 'GEFAKIT_RATE_LIMITER_KV', // Use the same KV store
  maxTokens: 60, // Allow a burst of 60 requests
  refillRatePerSecond: 1, // Refill 1 token per second (~60 per minute)
  kvExpirationTtl: 3600, // Default TTL 1 hour
  keyGenerator: (c) => `app-rate-limit:${c.req.header('cf-connecting-ip')}`
});

app.use('/api/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', envConfig.APP_URL || 'http://localhost:5173');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); 
  if (c.req.method === 'OPTIONS') {
    // Return OK status for preflight requests
    return c.text('OK', 200); 
  }
  await next();
});


// Log all requests
app.use(logger())

// All routes will have access to the db instance via context set by this middleware.
app.use('/api/*', dbMiddleware);

// Apply generic rate limiting to all API routes after db setup
app.use('/api/*', genericRateLimiter);

// Apply security headers to all API routes after rate limiting
app.use('/api/*', securityHeaders);

// Admin routes
app.route('/api/v1/admin', adminRoutesV1);

// Auth routes
app.route("/api/v1/auth", authRoutesV1);

// User routes
app.use("/api/v1/users/*", authMiddleware);
app.route("/api/v1/users", userRoutesV1);

// Todo routes
app.use("/api/v1/todos/*", authMiddleware); 
app.route("/api/v1/todos", todoRoutesV1);

// Organization routes
app.use("/api/v1/organizations/*", authMiddleware);
app.route("/api/v1/organizations", organizationsRoutesV1);

// Organization membership routes
app.use("/api/v1/organization-memberships/*", authMiddleware);
// Impersonation log middleware
app.use('/api/*', impersonationLogMiddleware);
app.route("/api/v1/organization-memberships", organizationMembershipRoutesV1);

// Organization invitation routes
app.use("/api/v1/organization-invitations/*", authMiddleware);
app.route("/api/v1/organization-invitations", organizationInvitationRoutesV1);



// Not found route
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

  if (err instanceof AppError) {
    console.log('IT IS A APP ERROR');
    const statusCode = typeof err.status === 'number' && err.status >= 100 && err.status <= 599 
      ? err.status 
      : 500;
    return c.json({ 
      ok: false, 
      errorMessage: err.message,
      errorDetails: err.details 
    }, statusCode as any);
  }

  return c.json({ ok: false, error: "Internal Server Error" }, 500);
});

export default app;
