import { getCookie } from 'hono/cookie';
import { Bindings } from '../types/hono';
import { createMiddleware } from 'hono/factory'
import { SessionDTO, UserDTO } from '@gefakit/shared/src/types/auth';
import { DbMiddleWareVariables } from './db';
import { createAuthRepository } from '../features/auth/auth.repository';
import { createAuthService } from '../features/auth/auth.service';
import { createOrganizationRepository } from '../features/organizations/organization.repository';
import { authErrors } from '../features/auth/auth.errors';
import { adminErrors } from '../features/admin/admin.errors';
import { ApiError } from '@gefakit/shared';

export interface AuthMiddleWareVariables extends DbMiddleWareVariables {
    user: UserDTO
    session: SessionDTO
    impersonatorUserId: number | null | undefined
}

// Define configuration interface
interface AuthMiddlewareConfig {
    allowedRoles?: ReadonlySet<string>;
}

// Return a function that accepts config and returns the middleware
export const authMiddleware = (config?: AuthMiddlewareConfig) => {
    return createMiddleware<{ Bindings: Bindings, Variables: AuthMiddleWareVariables }>(async (c, next) => {
        const db = c.get("db");
        const sessionToken = getCookie(c, 'gefakit-session');

        if (!sessionToken) {
            throw authErrors.unauthorized();
        }

        try {
            const authRepository = createAuthRepository({db});
            const authService = createAuthService({db, authRepository, createAuthRepository, createOrganizationRepository});        
            const { user, session } = await authService.getCurrentSession({token: sessionToken}); 

            if (!user || !session) {
                throw authErrors.unauthorized();
            }

            // Perform role check if allowedRoles are specified in config
            if (config?.allowedRoles) {
                if (typeof user.role !== 'string' || !config.allowedRoles.has(user.role)) {
                    // Use the existing error for permission denial
                    throw adminErrors.notAllowedToImpersonate();
                }
            }

            c.set('user', user);
            c.set('session', session);

            // Impersonator User ID
            if (session.impersonator_user_id) {
                c.set('impersonatorUserId', session.impersonator_user_id);
                // Optionally fetch and set the full impersonator user object if needed often
                // const impersonatorUser = await userRepository.findById(session.impersonator_user_id);
                // c.set('impersonatorUser', impersonatorUser);
            }

            await next();
        } catch (error: any) {
             // Log the original error regardless
            console.error("Auth Middleware Error:", error);

            // Allow specific ApiErrors (like permission errors) to propagate
            if (error instanceof ApiError) {
                throw error;
            }

            // Wrap other unexpected errors as a generic unauthorized error
            throw authErrors.unauthorized(); 
        }
    }); 
} 