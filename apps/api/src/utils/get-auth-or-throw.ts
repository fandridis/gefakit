import { SessionDTO, UserDTO } from "@gefakit/shared";
import { Context } from "hono";
import { Bindings } from "../types/hono";
import { AppVariables } from "../create-app";
import { authErrors } from "../features/auth/auth.errors";

interface GetAuthOrThrowProps {
    Bindings: Bindings;
    Variables: AppVariables;
}

export function getAuthOrThrow(c: Context<GetAuthOrThrowProps>): {user: UserDTO, session: SessionDTO} {
    const user = c.get('user');
    const session = c.get('session');

    if (!user || !session) { 
        throw authErrors.unauthorized();
    }

    return {user, session};
  }