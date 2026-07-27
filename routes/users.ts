import { Router } from 'express'
import { UserController } from '../controllers/users.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
    passwordRateLimit,
    registrationRateLimit,
} from '../middleware/rateLimits.js'

export const usersRouter = Router()

usersRouter.post(
    '/',
    registrationRateLimit,
    asyncHandler(UserController.create)
)

usersRouter.use(asyncHandler(requireAuth))

usersRouter.get('/', asyncHandler(UserController.getAll))

usersRouter.get('/me', asyncHandler(UserController.getMe))

usersRouter.post(
    '/me/password',
    passwordRateLimit,
    asyncHandler(UserController.changePassword)
)

usersRouter.get('/:username', asyncHandler(UserController.getByUsername))

usersRouter.patch('/:username', asyncHandler(UserController.update))

usersRouter.delete('/:username', asyncHandler(UserController.delete))
