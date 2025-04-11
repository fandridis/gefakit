import { z } from 'zod';

export const teacherSchema = z.object({
    id: z.string(),
    company_id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    phone_1: z.string(),
    phone_2: z.string().nullable().optional(),
    afm: z.string().nullable().optional(),
    amka: z.string().nullable().optional(),
    doy: z.string().nullable().optional(),
    bank_account_iban: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    birth_date: z.date().nullable().optional(),
    job_relation: z.string().nullable().optional(),
    identification_national_id: z.string().nullable().optional(),
    teacher_license_number: z.string().nullable().optional(),
    teacher_license_number_expiration_date: z.date().nullable().optional(),
    company_role: z.string().nullable().optional(),
    driving_license: z.any().nullable().optional(),
    created_at: z.date(),
    sys_deleted: z.boolean(),
    sys_deleted_at: z.date().nullable().optional(),
});

export type SharedTeacherDTO = z.infer<typeof teacherSchema>;