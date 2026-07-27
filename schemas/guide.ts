import z from 'zod'
import { materialsSchema } from './materials.js'
import { stepSchema } from './step.js'

export const guideSchema = z
    .object({
        titulo: z.string().trim().min(1).max(120),
        explicacion: z.string().trim().min(1).max(500),
        pasos: z.array(stepSchema).min(3).max(12),
        materiales: z.array(materialsSchema).min(1).max(24),
        tiempo_insumido: z.number().nonnegative().int(),
        costo: z.number().nonnegative(),
    })
    .strict()
