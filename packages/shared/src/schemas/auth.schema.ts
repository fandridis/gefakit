import { z } from 'zod';

export const userSchema = z.object({
    id: z.number(),
    email: z.string(),
    username: z.string().nullable().optional(),
    created_at: z.date(),
    email_verified: z.boolean(),
    role: z.string(),
});

export const sessionSchema = z.object({
    id: z.string(),
    user_id: z.number(),
    impersonator_user_id: z.number().nullable(),
    expires_at: z.date()
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

