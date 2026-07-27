import { IConversationMessage } from './conversationMessage.js'

export interface IConversationMessageList {
    messages: IConversationMessage[]
    conversation_id: number
}
