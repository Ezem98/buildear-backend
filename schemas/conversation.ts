import z from 'zod'
import { IConversation } from '../types/conversation.js'

export const conversationSchema = z
    .object({
        user_id: z.number().positive().int().optional(),
    })
    .strict()

export const validConversationData = (conversationData: unknown) => {
    return conversationSchema.safeParse(conversationData)
}

export const validPartialConversationData = (
    conversationData: IConversation
) => {
    return conversationSchema.partial().safeParse(conversationData)
}
