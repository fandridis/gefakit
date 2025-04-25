import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types/hono';
import { AuthMiddleWareVariables } from './auth'; // Requires session and user
// import { Session } from '@supabase/supabase-js'; // Assuming Session type is available - Removed as likely incorrect assumption
// import { Session } from '../features/auth/auth.repository'; // Removed - Type should be inferred from AuthMiddleWareVariables

// Extend AuthMiddleWareVariables as this middleware depends on user and session
// Ensure AuthMiddleWareVariables includes your actual Session type
interface ImpersonationLogMiddlewareVariables extends AuthMiddleWareVariables {}

/**
 * Middleware to log actions performed during an impersonation session.
 *
 * Assumes `authMiddleware` has run and populated `c.var.user` and `c.var.session`.
 * Assumes `c.var.session` contains the `impersonator_user_id` field.
 */
export const impersonationLogMiddleware = createMiddleware<{ Bindings: Bindings, Variables: ImpersonationLogMiddlewareVariables }>(async (c, next) => {
    const session = c.get('session'); // Assumes this contains { id: string, user_id: number, impersonator_user_id: number | null, ... }
    const user = c.get('user'); // The *impersonated* user

    const impersonatorUserId = session?.impersonator_user_id;

    if (impersonatorUserId && user && session) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType: 'IMPERSONATION_ACTION',
            impersonatorUserId: impersonatorUserId,
            impersonatedUserId: user.id,
            sessionId: session.id, // Use session ID if available
            action: `${c.req.method} ${c.req.path}`,
            ipAddress: c.req.raw.headers.get('cf-connecting-ip') || c.req.raw.headers.get('x-forwarded-for') || 'unknown',
            userAgent: c.req.raw.headers.get('user-agent') || 'unknown',
            // Note: Logging request body or response status might require running this *after* parsing or *around* next()
        };

        // Use a structured logger in a real application (e.g., Pino, Winston)
        console.log(`AUDIT_IMPERSONATION: ${JSON.stringify(logEntry)}`);
    }

    await next();

    // Optional: Log response status after the handler completes
    if (impersonatorUserId && user && session) {
       const status = c.res.status;
       console.log(`AUDIT_IMPERSONATION_COMPLETE: Action ${c.req.method} ${c.req.path} by ${impersonatorUserId} as ${user.id} resulted in status ${status}`);
    }
}); 