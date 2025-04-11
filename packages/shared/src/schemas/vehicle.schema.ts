import { z } from 'zod';

export const vehicleSchema = z.object({
    id: z.string(),
    description: z.string().nullable().optional(),
    license_plate: z.string().nullable().optional(),
    automatic: z.boolean(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    insurance_expiration_date: z.date().nullable().optional(),
    last_service_at: z.date().nullable().optional(),
    kteo_expiration_date: z.date().nullable().optional(),
    company_id: z.string(),
    created_at: z.date(),
    sys_deleted: z.boolean(),
    sys_deleted_at: z.date().nullable().optional(),
});

export type SharedVehicleDTO = z.infer<typeof vehicleSchema>;