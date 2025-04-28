import { ApiError } from '@gefakit/shared';
import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types/hono';
import { AuthMiddleWareVariables } from './auth';

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SUPPORT']);


interface AdminAuthMiddlewareVariables extends AuthMiddleWareVariables {}

export const adminAuth = createMiddleware<{ Bindings: Bindings, Variables: AdminAuthMiddlewareVariables }>(async (c, next) => {
    const user = c.get('user');

    if (!user || typeof user.role !== 'string') {
      // Should never happen, as auth middleware should have already checked this.
      throw new ApiError('Forbidden: Access denied.', 403);
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      throw new ApiError('Forbidden: You do not have permission to perform this action.', 403);
    }
    
    await next();
});
