import { Router } from 'express'
import { ConversationController } from '../controllers/conversations.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const conversationRouter = Router()

conversationRouter.use(asyncHandler(requireAuth))

conversationRouter.post('/', asyncHandler(ConversationController.create))

conversationRouter.get(
    '/user/:userId',
    asyncHandler(ConversationController.getAllByUserId)
)
conversationRouter.get('/:id', asyncHandler(ConversationController.get))

conversationRouter.delete('/:id', asyncHandler(ConversationController.delete))
