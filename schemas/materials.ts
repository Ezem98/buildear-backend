import z from 'zod'

export const materialsSchema = z
    .object({
        material: z.string().trim().min(1).max(100),
        cantidad: z.string().trim().min(1).max(100),
        finalidad: z.string().trim().min(1).max(240),
    })
    .strict()
