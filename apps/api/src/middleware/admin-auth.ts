// File: apps/api/src/middleware/adminAuth.ts

import { UserDTO } from '@gefakit/shared';
import { MiddlewareHandler } from 'hono';
import { AppError } from '../errors/app-error';
import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types/hono';
import { AuthMiddleWareVariables } from './auth';

// Define the roles that are allowed to pass this middleware
const ALLOWED_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SUPPORT']);

/**
 * Type definition for variables expected by this middleware.
 * It expects the `user` variable to be set by the preceding `authMiddleware`.
 */
interface AdminAuthMiddlewareVariables extends Pick<AuthMiddleWareVariables, 'user'> {
  // Add any specific variables needed only by this middleware if necessary
}

/**
 * Hono middleware to verify if the authenticated user has an admin or support role.
 *
 * Assumes that a previous middleware (e.g., `auth`) has already authenticated
 * the user and placed the user object (with a `role` property) into `c.var.user`.
 *
 * Throws an AppError(403 Forbidden) if the user does not have the required role.
 */
export const adminAuth = createMiddleware<{ Bindings: Bindings, Variables: AdminAuthMiddlewareVariables }>(async (c, next) => {
    console.log('[=== adminAuth ===]');

    // 1. Retrieve the user object set by the preceding `auth` middleware
    const user = c.get('user');

    // 2. Check if user exists and has a role
    if (!user || typeof user.role !== 'string') {
      // This case should ideally be caught by the `auth` middleware,
      // but we add a safeguard here.
      console.error('adminAuth middleware: User object not found or missing role in context.');
      throw new AppError('Forbidden: Access denied.', 403);
    }

    // 3. Check if the user's role is allowed
    if (!ALLOWED_ROLES.has(user.role)) {
      console.warn(`AUDIT: User ${user.id} with role ${user.role} attempted unauthorized access to admin route.`);
      throw new AppError('Forbidden: You do not have permission to perform this action.', 403);
    }
    
    // 4. User has the required role, proceed to the next middleware or route handler
    await next();
});
