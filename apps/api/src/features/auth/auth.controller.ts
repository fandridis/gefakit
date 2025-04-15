import { createAuthService } from "./auth.service";
import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { UserDTO } from "@gefakit/shared/src/types/auth";
import { AppError } from "../../errors/app-error";

export function createAuthController(db: Kysely<DB>) {
    const authService = createAuthService(db);

    async function getSession(token: string) {
        return authService.getCurrentSession(token);
    }

    async function signIn(data: { email: string; password: string }) {
        try {
            const result = await authService.signInWithEmail(data);
            return { user: result.user, sessionToken: result.sessionToken };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.signIn:", err);
            throw err;
        }
    }

    async function signUp(data: { email: string; password: string; username: string }): Promise<{ user: UserDTO }> {
        try {
            const user = await authService.signUpWithEmail(data);
            return { user };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.signUp:", err);
            throw err;
        }
    }

    async function signOut(sessionToken: string) {
        try {
            await authService.invalidateSession(sessionToken);
        } catch (err) {
            console.error("Unexpected error in controller.signOut:", err);
            throw err;
        }
    }

    return {
        signIn,
        signUp,
        signOut,
        getSession
    };
}