import { Router } from 'express'
import { FavoriteController } from '../controllers/favorites.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const favoritesRouter = Router()

favoritesRouter.use(asyncHandler(requireAuth))

favoritesRouter.post('/', asyncHandler(FavoriteController.create))

favoritesRouter.get('/:userId/:modelId', asyncHandler(FavoriteController.get))

favoritesRouter.delete(
    '/:userId/:modelId',
    asyncHandler(FavoriteController.delete)
)
