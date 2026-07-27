import z from 'zod'
import { IUserModel } from '../types/userModel.js'
import { guideSchema } from './guide.js'

export const userModelSchema = z
    .object({
        user_id: z.number().positive().int(),
        model_id: z.number().positive().int(),
        completed: z.number().int().min(0).max(1).default(0),
        current_step: z.number().positive().int().default(1),
        guide: guideSchema,
    })
    .strict()

export const validUserModelData = (userModelData: unknown) => {
    return userModelSchema.safeParse(userModelData)
}

export const validPartialUserModelData = (userModelData: unknown) => {
    return userModelSchema.partial().safeParse(userModelData)
}
