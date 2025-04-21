import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { signUpEmailRequestBodySchema, signInEmailRequestBodySchema } from "@gefakit/shared/src/schemas/auth.schema";
import { zValidator } from "../../lib/zod-utils";
import { GetSessionResponseDTO, SignInEmailResponseDTO, SignOutResponseDTO, SignUpEmailResponseDTO } from "@gefakit/shared/src/types/auth";
import { createAppError } from "../../errors";
import { DbMiddleWareVariables } from "../../middleware/db";
import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { createAuthService, AuthService } from "./auth.service";
import { OnboardingService, createOnboardingService } from "../onboarding/onboarding.service";
import { createAuthRepository } from "./auth.repository";
import { createOrganizationRepository } from "../organizations/organization.repository";
import { EmailService, createEmailService } from "../emails/email.service";

type AuthRouteVariables = DbMiddleWareVariables & {
    authService: AuthService;
    onboardingService: OnboardingService;
    emailService: EmailService;
}
const app = new Hono<{ Bindings: Bindings, Variables: AuthRouteVariables }>();

app.use('/*', async (c, next) => {
    const db = c.get("db") as Kysely<DB>;
    const authRepository = createAuthRepository({db});
    const orgRepository = createOrganizationRepository({db});

    const emailService = createEmailService();
    const authService = createAuthService({db, authRepository, createAuthRepository});
    const onboardingService = createOnboardingService({db, authRepository, createAuthRepository, createOrganizationRepository});
    
    c.set('authService', authService);
    c.set('onboardingService', onboardingService);
    c.set('emailService', emailService);
    await next();
});

app.get('/session', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw createAppError.auth.unauthorized();
    }

    const service = c.get('authService');
    const result = await service.getCurrentSession({ token: sessionToken });

    const response: GetSessionResponseDTO = { session: result.session, user: result.user };
    return c.json(response);
});

app.post('/sign-in/email', zValidator('json', signInEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');

    const service = c.get('authService');
    const result = await service.signInWithEmail(body);
    
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

    const onboardingService = c.get('onboardingService');
    const { user, verificationToken } = await onboardingService.signUpAndCreateOrganization(body);

    const emailService = c.get('emailService');
    await emailService.sendVerificationEmail({ 
        email: user.email, 
        token: verificationToken 
    });

    const response: SignUpEmailResponseDTO = { user };
    return c.json(response);
});

app.post('/sign-out', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');
    const service = c.get('authService');

    if (sessionToken) {
        await service.invalidateSession({ token: sessionToken });
        deleteCookie(c, 'gefakit-session');
    }

    const response: SignOutResponseDTO = { message: 'Signed out successfully' };
    return c.json(response);
});

app.get('/verify-email', async (c) => {
    const token = c.req.query('token');
    if (!token) {
        throw createAppError.auth.emailVerificationTokenNotFound();
    }

    const service = c.get('authService');
    await service.verifyEmail({ token });

    const response = { message: 'Email verified successfully' };
    return c.json(response);
});

export const authRoutesV1 = app;
