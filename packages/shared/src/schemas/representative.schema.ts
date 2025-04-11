import { z } from 'zod';

export const sharedRepresentativeSchema = z.object({
    id: z.string(),
    company_id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    father_first_name: z.string(),
    father_last_name: z.string(),
    identification_national_id: z.string().nullable().optional(),
    created_at: z.string(),
    sys_deleted: z.boolean(),
    sys_deleted_at: z.string().nullable().optional(),
});

export const sharedCreateRepresentativeSchema = sharedRepresentativeSchema
  .omit({
    id: true,
    created_at: true,
    sys_deleted: true,
    sys_deleted_at: true,
  })
  .extend({
    first_name: z.string().min(1, "Το πεδίο είναι υποχρεωτικό").max(50, "Πρέπει να είναι λιγότερο από 50 χαρακτήρες"),
    last_name: z.string().min(1, "Το πεδίο είναι υποχρεωτικό").max(50, "Πρέπει να είναι λιγότερο από 50 χαρακτήρες"),
    father_first_name: z.string().min(1, "Το πεδίο είναι υποχρεωτικό").max(50, "Πρέπει να είναι λιγότερο από 50 χαρακτήρες"),
    father_last_name: z.string().min(1, "Το πεδίο είναι υποχρεωτικό").max(50, "Πρέπει να είναι λιγότερο από 50 χαρακτήρες"),
    identification_national_id: z.string().min(1, "Το πεδίο είναι υποχρεωτικό").max(20, "Πρέπει να είναι λιγότερο από 20 χαρακτήρες"),
  });

export type SharedRepresentativeDTO = z.infer<typeof sharedRepresentativeSchema>;
export type SharedCreateRepresentativeDTO = z.infer<typeof sharedCreateRepresentativeSchema>;
