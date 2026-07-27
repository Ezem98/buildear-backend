import z from 'zod'
import { materialsSchema } from './materials.js'
import { stepSchema } from './step.js'

export const guideSchema = z
    .object({
        titulo: z.string().min(1),
        explicacion: z.string().min(1),
        pasos: z.array(stepSchema),
        materiales: z.array(materialsSchema),
        tiempo_insumido: z.number().positive().int(),
        costo: z.number().nonnegative(),
    })
    .strict()
