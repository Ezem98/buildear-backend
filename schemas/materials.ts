import z from 'zod'

export const materialsSchema = z
    .object({
        material: z.string().min(1),
        cantidad: z.string().min(1),
        finalidad: z.string().min(1),
    })
    .strict()
