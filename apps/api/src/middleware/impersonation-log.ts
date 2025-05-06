import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types/hono';
import { AppVariables } from '../create-app';
/**
 * Middleware to log actions performed during an impersonation session.
 *
 * Assumes `authMiddleware` has run and populated `c.var.user` and `c.var.session`.
 * Assumes `c.var.session` contains the `impersonator_user_id` field.
 */
export const impersonationLogMiddleware = createMiddleware<{ Bindings: Bindings, Variables: AppVariables }>(async (c, next) => {
    const session = c.get('session'); // Assumes this contains { id: string, user_id: number, impersonator_user_id: number | null, ... }
    const user = c.get('user'); // The *impersonated* user

    console.log('[Impersonation Log Middleware] session: ', session?.impersonator_user_id)
    console.log('[Impersonation Log Middleware] user: ', user?.username)

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