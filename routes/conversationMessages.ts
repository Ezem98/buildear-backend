import { Router } from 'express'
import { ConversationMessageController } from '../controllers/conversationMessages.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const conversationMessageRouter = Router()

conversationMessageRouter.use(asyncHandler(requireAuth))

conversationMessageRouter.post(
    '/',
    asyncHandler(ConversationMessageController.create)
)
conversationMessageRouter.post(
    '/all',
    asyncHandler(ConversationMessageController.createAll)
)

conversationMessageRouter.get(
    '/conversation/:conversationId',
    asyncHandler(ConversationMessageController.getAllByConversationId)
)
conversationMessageRouter.get(
    '/:id',
    asyncHandler(ConversationMessageController.get)
)

conversationMessageRouter.delete(
    '/:id',
    asyncHandler(ConversationMessageController.delete)
)
