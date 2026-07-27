import { Router } from 'express'
import { AuthController } from '../controllers/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { loginRateLimit } from '../middleware/rateLimits.js'

export const authRouter = Router()

authRouter.post('/login', loginRateLimit, asyncHandler(AuthController.login))
authRouter.post(
    '/logout',
    asyncHandler(requireAuth),
    asyncHandler(AuthController.logout)
)
