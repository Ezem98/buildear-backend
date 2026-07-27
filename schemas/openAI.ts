import z from 'zod'
import { ExperienceLevel } from '../enums/experienceLevel.js'
import { IOpenAI } from '../types/openAI.js'

export const openAISchema = z
    .object({
        modelCategory: z.number().int().positive(),
        modelName: z.string().trim().min(1).max(200),
        modelSize: z
            .object({
                height: z.number().int().positive(),
                width: z.number().int().positive(),
            })
            .strict(),
        experienceLevel: z
            .number()
            .int()
            .min(
                ExperienceLevel.BEGINNER,
                'Experience level must be at least 1'
            )
            .max(
                ExperienceLevel.ADVANCED,
                'Experience level must be at most 3'
            ),
    })
    .strict()

export const openAIMessageSchema = z
    .object({
        message: z.string().trim().min(1).max(4000),
        conversation_id: z.number().int().positive().optional(),
    })
    .strict()

export const validOpenAIData = (openAIData: IOpenAI) => {
    return openAISchema.safeParse(openAIData)
}

export const validOpenAIMessageData = (data: unknown) => {
    return openAIMessageSchema.safeParse(data)
}
