import z from 'zod'
import { IConversationMessage } from '../types/conversationMessage.js'
import { IConversationMessageList } from '../types/conversationMessageList.js'

export const conversationMessageSchema = z
    .object({
        message: z.string().min(1).max(20000),
        sender: z.enum(['user', 'assistant']),
        conversation_id: z.number().positive().int(),
    })
    .strict()

export const conversationMessageListSchema = z
    .object({
        messages: z.array(conversationMessageSchema).min(1).max(100),
    })
    .strict()

export const validConversationMessageListData = (
    conversationMessageListData: unknown
) => {
    return conversationMessageListSchema.safeParse(conversationMessageListData)
}

export const validConversationMessageData = (
    conversationMessageData: unknown
) => {
    return conversationMessageSchema.safeParse(conversationMessageData)
}

export const validPartialConversationMessageData = (
    conversationMessageData: IConversationMessage
) => {
    return conversationMessageSchema
        .partial()
        .safeParse(conversationMessageData)
}
