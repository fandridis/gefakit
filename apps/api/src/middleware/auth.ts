import { getCookie } from 'hono/cookie';
import { createAppError } from '../errors';
import { createAuthController } from '../features/auth/auth.controller';
import { Bindings } from '../types/hono';
import { createMiddleware } from 'hono/factory'
import { SessionDTO, UserDTO } from '@gefakit/shared/src/types/auth';
import { DbMiddleWareVariables } from './db';
import { createAuthRepository } from '../features/auth/auth.repository';
import { createAuthService } from '../features/auth/auth.service';
import { createOnboardingService } from '../features/onboarding/onboarding.service';
import { createOrganizationRepository } from '../features/organizations/organizations.repository';

export interface AuthMiddleWareVariables extends DbMiddleWareVariables {
    user: UserDTO
    session: SessionDTO
}

// Use createMiddleware instead of MiddlewareHandler directly
export const authMiddleware = createMiddleware<{ Bindings: Bindings, Variables: AuthMiddleWareVariables }>(async (c, next) => {
    const db = c.get("db");
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw createAppError.auth.unauthorized('No session token provided.');
    }

    try {
        const authRepository = createAuthRepository({db});
        const authService = createAuthService({db, authRepository});
        const orgRepository = createOrganizationRepository({db});
        const onboardingService = createOnboardingService({db, authRepository, orgRepository});
        const controller = createAuthController({authService, onboardingService});

        const { user, session } = await controller.getSession(sessionToken); 

        // These set calls should now be type-safe
        c.set('user', user);
        c.set('session', session);

        await next();
    } catch (error: any) {
        // Log the error for debugging?
        console.error("Auth Middleware Error:", error.message); 
        // Re-throw a specific unauthorized error for the client
        throw createAppError.auth.unauthorized('Invalid session token.');
    }
}); 