import { z } from 'zod';

export const userSchema = z.object({
    id: z.number(),
    email: z.string(),
    username: z.string().nullable().optional(),
    created_at: z.date(),
    email_verified: z.boolean(),
    role: z.string(),
    stripe_customer_id: z.string().nullable().optional(),
});

export const sessionSchema = z.object({
    id: z.string(),
    user_id: z.number(),
    impersonator_user_id: z.number().nullable(),
    role: z.string(),
    expires_at: z.date()
});

export const emailVerificationSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    value: z.string(),
    identifier: z.string(),
    expires_at: z.date(),
    created_at: z.date(),
    updated_at: z.date(),
});

export const passwordResetTokenSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    hashed_token: z.string(),
    expires_at: z.date(),
});

export const getSessionResponseSchema = z.object({
    session: sessionSchema.nullable(),
    user: userSchema.nullable(),
});

export const signInEmailRequestBodySchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const signInEmailResponseSchema = z.object({
    user: userSchema,
});

export const signUpEmailRequestBodySchema = z.object({
    username: z.string(),
    email: z.string().email(),
    password: z.string(),
});

export const signUpEmailResponseSchema = z.object({
    user: userSchema,
});

export const signOutResponseSchema = z.object({
    message: z.string(),
});

export const requestPasswordResetRequestBodySchema = z.object({
    email: z.string().email("Invalid email address"),
});

export const resetPasswordRequestBodySchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export const requestOtpBodySchema = z.object({
    email: z.string().email("Invalid email address"),
});

export const verifyOtpBodySchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6, 'OTP must be 6 characters long')
});

// Schema for requesting a new verification email
export const resendVerificationEmailRequestBodySchema = z.object({
    email: z.string().email('Invalid email address'),
});
