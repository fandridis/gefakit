import { ApiError } from '@gefakit/shared';
import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types/hono';
import { AuthMiddleWareVariables } from './auth';
import { adminErrors } from '../features/admin/admin.errors';

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SUPPORT']);


interface AdminAuthMiddlewareVariables extends AuthMiddleWareVariables {}

export const adminAuth = createMiddleware<{ Bindings: Bindings, Variables: AdminAuthMiddlewareVariables }>(async (c, next) => {
    const user = c.get('user');

    if (!user || typeof user.role !== 'string') {
      // Should never happen, as auth middleware should have already checked this.
      throw adminErrors.notAllowedToImpersonate();
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      throw adminErrors.notAllowedToImpersonate();
    }
    
    await next();
});
