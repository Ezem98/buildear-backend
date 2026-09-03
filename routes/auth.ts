import { Router } from 'express'
import { AuthController } from '../controllers/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { loginRateLimit, refreshRateLimit } from '../middleware/rateLimits.js'

export const authRouter = Router()

authRouter.post('/login', loginRateLimit, asyncHandler(AuthController.login))
authRouter.post(
    '/refresh',
    refreshRateLimit,
    asyncHandler(AuthController.refresh)
)
authRouter.post(
    '/logout',
    asyncHandler(requireAuth),
    asyncHandler(AuthController.logout)
)
