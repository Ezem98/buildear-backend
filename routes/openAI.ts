import { Router } from 'express'
import { OpenAIController } from '../controllers/openAI.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { openAIRateLimit } from '../middleware/rateLimits.js'

export const openAIRouter = Router()

openAIRouter.use(asyncHandler(requireAuth))
openAIRouter.use(openAIRateLimit)

openAIRouter.post('/', asyncHandler(OpenAIController.generateStepsWithOpenAI))
openAIRouter.post('/message', asyncHandler(OpenAIController.responseMessage))
