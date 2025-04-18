import { Hono } from "hono";
import { createAuthController, AuthController } from "./auth.controller";
import { Bindings } from "../../types/hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { signUpEmailRequestBodySchema, signInEmailRequestBodySchema } from "@gefakit/shared/src/schemas/auth.schema";
import { zValidator } from "../../lib/zod-utils";
import { GetSessionResponseDTO, SignInEmailResponseDTO, SignOutResponseDTO, SignUpEmailResponseDTO } from "@gefakit/shared/src/types/auth";
import { createAppError } from "../../errors";
import { DbMiddleWareVariables } from "../../middleware/db";
import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { createAuthService } from "./auth.service";
import { createOnboardingService } from "../onboarding/onboarding.service";
import { createAuthRepository } from "./auth.repository";
import { createOrganizationRepository } from "../organizations/organizations.repository";

type AuthRouteVariables = DbMiddleWareVariables & {
    authController: AuthController;
}
const app = new Hono<{ Bindings: Bindings, Variables: AuthRouteVariables }>();

app.use('/*', async (c, next) => {
    const db = c.get("db") as Kysely<DB>;
    const authRepository = createAuthRepository({db});
    const orgRepository = createOrganizationRepository({db});
    const authService = createAuthService({db, authRepository});
    const onboardingService = createOnboardingService({db, authRepository, orgRepository});
    const authController = createAuthController({authService, onboardingService});
    c.set('authController', authController);
    await next();
});

app.get('/session', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw createAppError.auth.unauthorized();
    }

    const controller = c.get('authController');
    const result = await controller.getSession(sessionToken);

    const response: GetSessionResponseDTO = { session: result.session, user: result.user };
    return c.json(response);
});

app.post('/sign-in/email', zValidator('json', signInEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');

    const controller = c.get('authController');
    const result = await controller.signIn(body);
    
    setCookie(c, 'gefakit-session', result.sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
    });

    const response: SignInEmailResponseDTO = { user: result.user };
    return c.json(response);
});

app.post('/sign-up/email', zValidator('json', signUpEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');

    const controller = c.get('authController');
    const { user } = await controller.signUp(body);

    const response: SignUpEmailResponseDTO = { user };
    return c.json(response);
});

app.post('/sign-out', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');
    const controller = c.get('authController');

    if (sessionToken) {
        await controller.signOut(sessionToken);
        deleteCookie(c, 'gefakit-session');
    }

    const response: SignOutResponseDTO = { message: 'Signed out successfully' };
    return c.json(response);
});

export const authRoutesV1 = app;
