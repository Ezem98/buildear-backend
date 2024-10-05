import { Request, Response } from 'express'
import { FavoriteModel } from '../models/favorites.ts'
import { validFavoriteData } from '../schemas/favorites.ts'

export class FavoriteController {
    static async create(req: Request, res: Response) {
        const { body } = req
        const validationResult = validFavoriteData(body)

        if (validationResult.error)
            return res
                .status(400)
                .json({ error: JSON.parse(validationResult.error.message) })

        const { successfully, message, data } = await FavoriteModel.create(
            validationResult.data
        )

        if (!successfully)
            return res.status(400).send({ successfully, message })

        return res.status(201).json({ successfully, message, data })
    }

    static async delete(req: Request, res: Response) {
        const { id } = req.params

        const { successfully, message } = await FavoriteModel.delete(id)
        if (!successfully) return res.status(400).send({ message })
        return res.send({ message })
    }
}