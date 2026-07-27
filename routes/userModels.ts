import { Router } from 'express'
import { UserModelController } from '../controllers/userModel.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const userModelsRouter = Router()

userModelsRouter.use(asyncHandler(requireAuth))

userModelsRouter.get(
    '/user/:userId',
    asyncHandler(UserModelController.getAllByUserId)
)
userModelsRouter.get(
    '/model/:modelId',
    asyncHandler(UserModelController.getAllByModelId)
)
userModelsRouter.get('/:userId/:modelId', asyncHandler(UserModelController.get))

userModelsRouter.post('/', asyncHandler(UserModelController.create))

userModelsRouter.patch('/:id', asyncHandler(UserModelController.update))

userModelsRouter.delete(
    '/:userId/:modelId',
    asyncHandler(UserModelController.delete)
)
