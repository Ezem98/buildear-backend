import z from 'zod'
import { Categories } from '../enums/categories.js'
import { IModel } from '../types/model.js'

export const modelSchema = z
    .object({
        name: z.string().min(6, 'Model name must be at least 6 characters'),
        description: z
            .string()
            .min(10, 'Model description must be at least 10 characters'),
        data: z.string(),
        image: z.string(),
        difficulty_rating: z.number().int().min(1).max(5),
        category_id: z
            .number()
            .int()
            .min(Categories.Roof, 'Category ID must be at least 1')
            .max(Categories.Foundation, 'Category ID must be at most 5'),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        position: z.enum(['horizontal', 'vertical']),
    })
    .strict()

export const validModelData = (modelData: unknown) => {
    return modelSchema.safeParse(modelData)
}

export const validPartialModelData = (modelData: unknown) => {
    return modelSchema.partial().safeParse(modelData)
}
