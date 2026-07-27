import z from 'zod'

export const stepSchema = z
    .object({
        paso: z.number().positive().int(),
        titulo: z.string().trim().min(1).max(90),
        descripcion: z.string().trim().min(1).max(900),
    })
    .strict()
