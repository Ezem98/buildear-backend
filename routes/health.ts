import { Router } from 'express'
import { AppError } from '../errors/appError.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { db } from '../utils/consts.js'

export const healthRouter = Router()

healthRouter.get('/live', (_request, response) => {
    response.json({ status: 'ok' })
})

healthRouter.get(
    '/ready',
    asyncHandler(async (_request, response) => {
        try {
            await db.execute('SELECT 1 AS ready')
        } catch {
            throw new AppError(
                503,
                'DATABASE_NOT_READY',
                'La base de datos no está disponible'
            )
        }
        response.json({ status: 'ok', dependencies: { database: 'ready' } })
    })
)
