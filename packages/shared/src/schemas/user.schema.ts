import { z } from "zod";
import { userSchema } from "./auth.schema";

export const updateUserRequestBodySchema = userSchema.partial().extend({
    username: z.string()
        .min(2, 'Username must be at least 2 characters.')
        .max(20, 'Username must be less than 20 characters')
        .optional(),
});

export const updateUserResponseSchema = userSchema;