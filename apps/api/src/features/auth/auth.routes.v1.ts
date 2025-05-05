import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { 
    signUpEmailRequestBodySchema, 
    signInEmailRequestBodySchema, 
    requestPasswordResetRequestBodySchema,
    resetPasswordRequestBodySchema,
    requestOtpBodySchema,
    verifyOtpBodySchema,
    resendVerificationEmailRequestBodySchema
} from "@gefakit/shared/src/schemas/auth.schema";
import { zValidator } from "../../lib/zod-validator";
import { GetSessionResponseDTO, SignInEmailResponseDTO, SignInOtpResponseDTO, SignOutResponseDTO, SignUpEmailResponseDTO, UserDTO } from "@gefakit/shared/src/types/auth";
import { Kysely } from "kysely";
import { DB } from "../../db/db-types";
import { AuthService, OAuthUserDetails } from "./auth.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { EmailService } from "../emails/email.service";
import { generateState, OAuth2RequestError } from "arctic";
import { createOAuthClients, OAuthClients } from "../../lib/oauth";
import { kvTokenBucketRateLimiter } from "../../middleware/rate-limiter";
import { getAuthService, getOnboardingService } from "../../utils/get-service";
import { getEmailService, GetServiceProps } from "../../utils/get-service";
import { authErrors } from "./auth.errors";
import { AppVariables } from "../../create-app";
import { Context } from 'hono';

const authRateLimiter = kvTokenBucketRateLimiter({
    kvBindingName: 'GEFAKIT_RATE_LIMITER_KV',
    maxTokens: 15, // Allow a burst of 15 requests 
    refillRatePerSecond: 0.167, // Refill at ~10 tokens per minute
    kvExpirationTtl: 3600, // Default TTL 1 hour
    keyGenerator: (c) => `auth-rate-limit:${c.req.header('cf-connecting-ip')}`
  });

const emailRateLimiter = kvTokenBucketRateLimiter({
    kvBindingName: 'GEFAKIT_RATE_LIMITER_KV',
    maxTokens: 5, // Allow a small burst of 5 requests
    refillRatePerSecond: 0.00058, // Refill at ~50 tokens per day (50 / 86400 ≈ 0.00058)
    kvExpirationTtl: 7200, // Expire keys after 2 hours
    keyGenerator: (c) => `auth-email-limit:${c.req.header('cf-connecting-ip')}`
});

// Define interfaces for expected OAuth user data structures
interface GitHubUser {
    id: number;
    login: string;
    email: string | null;
}

interface GitHubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
}

interface GoogleUser {
    sub: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
}

const setStateCookie = (c: any, name: string, value: string) => {
    setCookie(c, name, value, {
        path: "/",
        secure: true,
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "Lax"
    });
};

const setSessionCookie = (c: any, sessionToken: string) => {
    setCookie(c, 'gefakit-session', sessionToken, {
        httpOnly: true,
        secure: true, // Ensure this is true in production
        sameSite: 'Lax',
        path: '/', 
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });
};

const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>();


app.use('/*', authRateLimiter);


app.get('/session', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw authErrors.unauthorized();
    }

    const authService = getAuthService(c);
    const result = await authService.getCurrentSession({ token: sessionToken });

    // If the session was extended, a new token is issued. Set the new cookie.
    if (result.newToken) {
        setSessionCookie(c, result.newToken);
    }

    // Ensure result.user and result.session are not null before creating response
    if (!result.session || !result.user) {
        // This case should ideally be handled by the service throwing an error 
        // or validateSession returning nulls which lead to an error earlier.
        // But as a safeguard:
        deleteCookie(c, 'gefakit-session'); // Clear potentially invalid cookie
        throw authErrors.unauthorized(); 
    }

    const response: GetSessionResponseDTO = { session: result.session, user: result.user };
    return c.json(response);
});

app.post('/sign-in/email', zValidator('json', signInEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');

    const authService = getAuthService(c);
    const result = await authService.signInWithEmail(body);
    
    setSessionCookie(c, result.sessionToken);

    const response: SignInEmailResponseDTO = { user: result.user };
    return c.json(response);
});

app.post('/sign-up/email', zValidator('json', signUpEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');

    const onboardingService = getOnboardingService(c);
    const { user, verificationToken } = await onboardingService.signUpAndCreateOrganization(body);

    const emailService = getEmailService(c);
    await emailService.sendVerificationEmail({ 
        email: user.email, 
        token: verificationToken 
    });

    const response: SignUpEmailResponseDTO = { user };
    return c.json(response);
});

app.post('/sign-out', async (c) => {
    const sessionToken = getCookie(c, 'gefakit-session');
    const authService = getAuthService(c);

    if (sessionToken) {
        await authService.invalidateSession({ token: sessionToken });
        deleteCookie(c, 'gefakit-session');
    }

    const response: SignOutResponseDTO = { message: 'Signed out successfully' };
    return c.json(response);
});

app.get('/verify-email', async (c) => {
    const token = c.req.query('token');
    if (!token) {
        throw authErrors.emailVerificationTokenNotFound();
    }

    const authService = getAuthService(c);
    await authService.verifyEmail({ token });

    const response = { message: 'Email verified successfully' };
    return c.json(response);
});

app.get('/sign-in/github', async (c) => {
    const state = generateState();
    const oauthClients = createOAuthClients();
    const url = await oauthClients.github.createAuthorizationURL(state, []);
    
    setStateCookie(c, 'github_oauth_state', state);
    
    return c.redirect(url.toString());
});

app.get('/login/github/callback', async (c) => {
    const oauthClients = createOAuthClients();
    const authService = getAuthService(c);
    
    const code = c.req.query('code');
    const state = c.req.query('state');
    const storedState = getCookie(c, 'github_oauth_state');

    deleteCookie(c, 'github_oauth_state');

    if (!code || !state || !storedState || state !== storedState) {
        console.error('GitHub OAuth Error: State mismatch or missing params', { code, state, storedState });
        return c.redirect('/sign-in?error=oauth_state_mismatch'); 
    }

    try {
        const tokens = await oauthClients.github.validateAuthorizationCode(code);
        const accessToken = (tokens as any)?.data?.access_token;

        if (typeof accessToken !== 'string') {
            throw new Error('Access token not found or invalid in GitHub OAuth response');
        }

        const githubUserResponse = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "gefakit-api"
            }
        });
        const githubUser = await githubUserResponse.json() as GitHubUser;
        
        if (!githubUserResponse.ok || !githubUser.id) {
            console.error('GitHub API Error:', githubUser);
            // TODO: It will probably redirect to the client with an error message.
            return c.redirect('/sign-in?error=github_api_failed');
        }

        let email = githubUser.email;
        if (email === undefined) email = null;

        if (!email) {
            const emailsResponse = await fetch("https://api.github.com/user/emails", {
                 headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "User-Agent": "gefakit-api"
                }
            });
            if (emailsResponse.ok) {
                const emails = await emailsResponse.json() as GitHubEmail[];
                const primaryEmail = emails.find(e => e.primary && e.verified);
                email = primaryEmail?.email ?? null;
            } else {
                 console.warn('Could not fetch GitHub emails:', await emailsResponse.text());
            }
        }
        
        const oauthDetails: OAuthUserDetails = {
            provider: 'github',
            providerUserId: githubUser.id.toString(),
            email: email,
            username: githubUser.login
        };

        const { sessionToken } = await authService.handleOAuthCallback(oauthDetails);

        setSessionCookie(c, sessionToken);

        return c.redirect('/'); 

    } catch (e) {
        console.error('GitHub OAuth Callback Error:', e);
        if (e instanceof OAuth2RequestError) {
            return c.redirect('/sign-in?error=oauth_invalid_code'); 
        }
        return c.redirect('/sign-in?error=oauth_callback_failed'); 
    }
});

// app.get('/login/google', async (c) => {
//     const state = generateState();
//     const codeVerifier = generateCodeVerifier();
//     const oauthClients = c.get('oauthClients');
//     const url = await oauthClients.google.createAuthorizationURL(state, codeVerifier, ["profile", "email"]);

//     setStateCookie(c, 'google_oauth_state', state);
//     setStateCookie(c, 'google_oauth_code_verifier', codeVerifier);

//     return c.redirect(url.toString());
// });

// app.get('/login/google/callback', async (c) => {
//     const oauthClients = c.get('oauthClients');
//     const service = c.get('authService');

//     const code = c.req.query('code');
//     const state = c.req.query('state');
//     const storedState = getCookie(c, 'google_oauth_state');
//     const storedCodeVerifier = getCookie(c, 'google_oauth_code_verifier');

//     deleteCookie(c, 'google_oauth_state');
//     deleteCookie(c, 'google_oauth_code_verifier');

//     if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
//         console.error('Google OAuth Error: State/Verifier mismatch or missing params', { code, state, storedState, storedCodeVerifier });
//         return c.redirect('/sign-in?error=oauth_state_mismatch');
//     }

//     try {
//         const tokens = await oauthClients.google.validateAuthorizationCode(code, storedCodeVerifier);
//         const googleUserResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
//             headers: {
//                 Authorization: `Bearer ${tokens.accessToken}`
//             }
//         });
//         const googleUser = await googleUserResponse.json() as GoogleUser;

//         if (!googleUserResponse.ok || !googleUser.sub) {
//             console.error('Google UserInfo Error:', googleUser);
//             return c.redirect('/sign-in?error=google_api_failed');
//         }

//         let email = googleUser.email_verified ? googleUser.email : null;
//         if (email === undefined) email = null;
        
//         let username = googleUser.name ?? googleUser.email ?? 'Google User';
//         if (username === undefined) username = 'Google User';

//         const oauthDetails: OAuthUserDetails = {
//             provider: 'google',
//             providerUserId: googleUser.sub,
//             email: email,
//             username: username
//         };
        
//         if (!oauthDetails.email) {
//              console.warn('Google OAuth: Email not provided or not verified.', googleUser);
//         }

//         const { user, sessionToken } = await service.handleOAuthCallback(oauthDetails);

//         setCookie(c, 'gefakit-session', sessionToken, {
//             httpOnly: true,
//             secure: true,
//             sameSite: 'Lax'
//         });

//         return c.redirect('/');

//     } catch (e) {
//         console.error('Google OAuth Callback Error:', e);
//         if (e instanceof OAuth2RequestError) {
//             return c.redirect('/sign-in?error=oauth_invalid_code');
//         }
//         return c.redirect('/sign-in?error=oauth_callback_failed');
//     }
// });

// --- Password Reset Routes ---

app.post('/request-password-reset', emailRateLimiter, zValidator('json', requestPasswordResetRequestBodySchema), async (c) => {
    const body = c.req.valid('json');
    const authService = getAuthService(c);
    const emailService = getEmailService(c);

    const plainToken = await authService.requestPasswordReset({ email: body.email });

    if (plainToken) {
        try {
            await emailService.sendPasswordResetEmail({ email: body.email, token: plainToken });
        } catch (error) {
            console.error(`Failed to send password reset email to ${body.email}:`, error);
        }
    }

    // Always return a generic success response to prevent email enumeration
    return c.json({ message: "If an account with that email exists, a password reset link has been sent." }, 200);
});

app.post('/reset-password', zValidator('json', resetPasswordRequestBodySchema), async (c) => {
    const body = c.req.valid('json');
    const authService = getAuthService(c);

    await authService.resetPassword({ 
        token: body.token, 
        newPassword: body.newPassword 
    });

    // On successful password reset, potentially invalidate the cookie 
    // if you want to force re-login, although the service already invalidates sessions.
    deleteCookie(c, 'gefakit-session'); 

    return c.json({ message: "Password has been reset successfully." }, 200);
});

// --- Resend Verification Email Route ---

app.post('/resend-verification-email', emailRateLimiter, zValidator('json', resendVerificationEmailRequestBodySchema), async (c) => {
    const body = c.req.valid('json');
    const authService = getAuthService(c);
    const emailService = getEmailService(c);

    // Call a new service method to handle resending the verification email
    // This method should find the user, check if already verified, 
    // generate a new token if needed, and return it.
    const result = await authService.resendVerificationEmail({ email: body.email });

    // Only send an email if a new token was actually generated (i.e., user exists and wasn't verified)
    if (result?.verificationToken) {
        try {
            await emailService.sendVerificationEmail({ 
                email: result.user.email, 
                token: result.verificationToken 
            });
        } catch (error) {
            console.error(`Failed to resend verification email to ${body.email}:`, error);
            // Decide if you want to throw an error back to the client or just log
        }
    }

    // Always return a generic success response to prevent enumeration attacks
    return c.json({ message: "If your email address is registered and not verified, a new verification link has been sent." }, 200);
});

// --- OTP Sign In Routes ---

app.post('/sign-in/request-otp', emailRateLimiter, zValidator('json', requestOtpBodySchema), async (c) => {
    const body = c.req.valid('json');
    const authService = getAuthService(c);
    const emailService = getEmailService(c);

    const plainOtp = await authService.requestOtpSignIn({ email: body.email });

    if (plainOtp) {
        try {
            await emailService.sendOtpEmail({ email: body.email, otp: plainOtp });
        } catch (error) {
            console.error(`Failed to send OTP email to ${body.email}:`, error);
        }
    }

    // Always return a generic success response
    return c.json({ message: "If an account with that email exists and is verified, an OTP code has been sent." }, 200);
});

app.post('/sign-in/verify-otp', zValidator('json', verifyOtpBodySchema), async (c) => {
    const body = c.req.valid('json');
    const authService = getAuthService(c);

    const result = await authService.verifyOtpAndSignIn(body);
    
    setSessionCookie(c, result.sessionToken);

    const response: SignInOtpResponseDTO = { user: result.user }; // Use the defined interface
    return c.json(response);
});

export const authRoutesV1 = app;
