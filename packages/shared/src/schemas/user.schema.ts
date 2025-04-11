    import { z } from 'zod';

    export const userSchema = z.object({
        id: z.string(),
        email: z.string(),
        first_name: z.string().nullable().optional(),
        last_name: z.string().nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        created_at: z.date(),
        sys_deleted: z.boolean(),
        sys_deleted_at: z.date().nullable().optional(),
    });

    export type SharedUserDTO = z.infer<typeof userSchema>;
