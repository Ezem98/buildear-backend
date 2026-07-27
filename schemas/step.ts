import z from 'zod'

export const stepSchema = z
    .object({
        paso: z.number().positive().int(),
        titulo: z.string().min(1),
        descripcion: z.string().min(1),
    })
    .strict()
