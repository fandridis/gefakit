import { SessionDTO, UserDTO } from "@gefakit/shared";
import { Context } from "hono";
import { Bindings } from "../types/hono";
import { AppVariables } from "../create-app";
import { authErrors } from "../features/auth/auth.errors";

interface GetAuthOrThrowProps<T extends AppVariables = AppVariables> {
    Bindings: Bindings;
    Variables: T;
}

export function getAuthOrThrow<T extends AppVariables>(c: Context<GetAuthOrThrowProps<T>>): { user: UserDTO, session: SessionDTO } {
    const user = c.get('user');
    const session = c.get('session');

    if (!user || !session) {
        throw authErrors.unauthorized();
    }

    return { user, session };
}