import { Router } from 'express'
import { ModelController } from '../controllers/models.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const modelsRouter = Router()

modelsRouter.get('/', asyncHandler(ModelController.getAll))

modelsRouter.get(
    '/category/:categoryId',
    asyncHandler(ModelController.getByCategoryId)
)

modelsRouter.get('/search/:search', asyncHandler(ModelController.getByName))

modelsRouter.get('/:id', asyncHandler(ModelController.getById))

modelsRouter.get(
    '/user/:userId',
    asyncHandler(requireAuth),
    asyncHandler(ModelController.getByUserId)
)

modelsRouter.get(
    '/favorite/:userId',
    asyncHandler(requireAuth),
    asyncHandler(ModelController.getFavorites)
)

modelsRouter.post(
    '/',
    asyncHandler(requireAuth),
    requireAdmin,
    asyncHandler(ModelController.create)
)

modelsRouter.patch(
    '/:id',
    asyncHandler(requireAuth),
    requireAdmin,
    asyncHandler(ModelController.update)
)

modelsRouter.delete(
    '/:id',
    asyncHandler(requireAuth),
    requireAdmin,
    asyncHandler(ModelController.delete)
)
