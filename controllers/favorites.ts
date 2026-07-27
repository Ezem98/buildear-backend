import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { assertOwnedUserId } from '../middleware/auth.js'
import { FavoriteModel } from '../models/favorites.js'
import { validFavoriteData } from '../schemas/favorites.js'

export class FavoriteController {
    static async create(req: Request, res: Response) {
        const validationResult = validFavoriteData(req.body)

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos del favorito son inválidos',
                validationResult.error.issues
            )

        assertOwnedUserId(req, validationResult.data.user_id)

        const { successfully, data } = await FavoriteModel.create(
            validationResult.data
        )

        if (!successfully)
            throw new AppError(
                409,
                'FAVORITE_CREATE_FAILED',
                'No se pudo crear el favorito'
            )

        return res.status(201).json({
            successfully,
            message: 'Favorite created',
            data,
        })
    }

    static async get(req: Request, res: Response) {
        const { modelId } = req.params
        const userId = assertOwnedUserId(req, req.params.userId)

        const isFav = await FavoriteModel.get(userId, +modelId)

        return res.json({ data: isFav })
    }

    static async delete(req: Request, res: Response) {
        const { modelId } = req.params
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully } = await FavoriteModel.delete(
            String(userId),
            String(modelId)
        )
        if (!successfully)
            throw new AppError(
                500,
                'FAVORITE_DELETE_FAILED',
                'No se pudo eliminar el favorito'
            )
        return res.status(204).send()
    }
}
