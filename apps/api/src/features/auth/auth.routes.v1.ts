import { Hono } from "hono";
import { createAuthController } from "./auth.controller";
import { Bindings } from "../../types/hono";
import { Variables } from "../../types/hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { signUpEmailRequestBodySchema, signInEmailRequestBodySchema, signUpEmailResponseSchema } from "@gefakit/shared/src/schemas/auth.schema";
import { zValidator } from "../../lib/zod-utils";
import { z } from "zod";
import { GetSessionResponseDTO, SignInEmailResponseDTO, SignOutResponseDTO } from "@gefakit/shared/src/types/auth";
import { createAppError } from "../../errors";

export type SignUpEmailResponseDTO = z.infer<typeof signUpEmailResponseSchema>;

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get('/session', async (c) => {
    const db = c.get("db");
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw createAppError.auth.unauthorized();
    }

    const controller = createAuthController(db);
    const result = await controller.getSession(sessionToken);

    const response: GetSessionResponseDTO = { session: result.session, user: result.user };
    return c.json(response);
});

app.post('/sign-in/email', zValidator('json', signInEmailRequestBodySchema), async (c) => {
    const db = c.get("db");
    const body = c.req.valid('json');
    
    const controller = createAuthController(db);
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
    const db = c.get("db");
    const body = c.req.valid('json');

    const controller = createAuthController(db);
    const { user } = await controller.signUp(body);

    const response: SignUpEmailResponseDTO = { user };
    return c.json(response);
});

app.post('/sign-out', async (c) => {
    const db = c.get("db");
    const sessionToken = getCookie(c, 'gefakit-session');
    const controller = createAuthController(db);

    if (sessionToken) {
        await controller.signOut(sessionToken);
        deleteCookie(c, 'gefakit-session');
    }

    const response: SignOutResponseDTO = { message: 'Signed out successfully' };
    return c.json(response);
});

export const authRoutesV1 = app;
