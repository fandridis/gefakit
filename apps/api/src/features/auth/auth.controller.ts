import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { UserDTO } from "@gefakit/shared/src/types/auth";
import { AppError } from "../../errors/app-error";
import { createOnboardingService, OnboardingService } from "../onboarding/onboarding.service";
import { AuthService, createAuthService } from "./auth.service";

export type AuthController = ReturnType<typeof createAuthController>;

export function createAuthController({
    authService,
    onboardingService,
}: {
    authService: AuthService;
    onboardingService: OnboardingService;
}) {
    async function getSession(token: string) {
        console.log('============================== AT GET SESSION ==============================')
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

    async function signUp(data: { email: string; password: string; username: string }) {
        try {
            const { user, orgId }  = await onboardingService.signUpAndCreateOrganization(data);
            console.log(`Created user ${user.id} with default organization ${orgId}`);
            return { user, orgId: orgId };
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

    async function verifyEmail(token: string) {
        if (!token || typeof token !== 'string') {
            throw new AppError('Verification token is missing or invalid.', 400);
        }

        try {
            await authService.verifyEmail(token);
            // TODO: Decide on response. Redirect? Simple success message?
            return { success: true, message: 'Email verified successfully.' }; 
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.verifyEmail:", err);
            // TODO: Handle specific errors from authService (e.g., expired/invalid token)
            throw new AppError('Failed to verify email.', 500); 
        }
    }

    return {
        signIn,
        signUp,
        signOut,
        getSession,
        verifyEmail
    };
}