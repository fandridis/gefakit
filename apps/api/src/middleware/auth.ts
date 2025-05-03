import { getCookie } from 'hono/cookie';
import { Bindings } from '../types/hono';
import { createMiddleware } from 'hono/factory'
import { SessionDTO, UserDTO } from '@gefakit/shared/src/types/auth';
import { DbMiddleWareVariables } from './db';
import { createAuthRepository } from '../features/auth/auth.repository';
import { createAuthService } from '../features/auth/auth.service';
import { createOrganizationRepository } from '../features/organizations/organization.repository';
import { authErrors } from '../features/auth/auth.errors';

export interface AuthMiddleWareVariables extends DbMiddleWareVariables {
    user: UserDTO
    session: SessionDTO
    impersonatorUserId: number | null | undefined
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings, Variables: AuthMiddleWareVariables }>(async (c, next) => {
    const db = c.get("db");
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw authErrors.unauthorized('No session token provided.');
    }

    try {
        const authRepository = createAuthRepository({db});
        const authService = createAuthService({db, authRepository, createAuthRepository, createOrganizationRepository});        
        const { user, session } = await authService.getCurrentSession({token: sessionToken}); 

        if (!user || !session) {
            throw authErrors.unauthorized('Invalid session token.');
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
        console.error("Auth Middleware Error:", error.message); 
        // Re-throw a specific unauthorized error for the client
        throw authErrors.unauthorized('Invalid session token.');
    }
}); 