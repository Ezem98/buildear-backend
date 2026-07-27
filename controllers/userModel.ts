import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { assertOwnedUserId, authenticatedUser } from '../middleware/auth.js'
import { UserModelModel } from '../models/userModel.js'
import {
    validPartialUserModelData,
    validUserModelData,
} from '../schemas/userModel.js'

export class UserModelController {
    static async getAllByUserId(req: Request, res: Response) {
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully, message, data } =
            await UserModelModel.getAllByUserId(userId)

        if (!successfully)
            throw new AppError(
                500,
                'PROGRESS_READ_FAILED',
                'No se pudo consultar el progreso'
            )

        res.json({ successfully, message, data })
    }

    static async getAllByModelId(req: Request, res: Response) {
        const { modelId } = req.params
        const auth = authenticatedUser(req)

        const { successfully, message, data } =
            await UserModelModel.getAllByModelId(+modelId, auth.userId)

        if (!successfully)
            throw new AppError(
                500,
                'PROGRESS_READ_FAILED',
                'No se pudo consultar el progreso'
            )

        res.json({ successfully, message, data })
    }

    static async get(req: Request, res: Response) {
        const { modelId } = req.params
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully, message, data } = await UserModelModel.get(
            userId,
            +modelId
        )

        if (!successfully)
            throw new AppError(
                500,
                'PROGRESS_READ_FAILED',
                'No se pudo consultar el progreso'
            )
        return res.json({ successfully, message, data })
    }

    static async create(req: Request, res: Response) {
        const { body } = req
        const { guideObject, guide, ...userModelData } = body

        const validationResult = validUserModelData({
            ...userModelData,
            guide: guideObject ?? guide,
        })

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de progreso son inválidos',
                validationResult.error.issues
            )

        assertOwnedUserId(req, validationResult.data.user_id)

        const { successfully, message, data } = await UserModelModel.create(
            validationResult.data
        )

        if (!successfully)
            throw new AppError(
                409,
                'PROGRESS_CREATE_FAILED',
                'No se pudo crear el progreso'
            )

        return res.status(201).json({ successfully, message, data })
    }

    static async update(req: Request, res: Response) {
        const { body } = req

        const { id } = req.params

        const validationResult = validPartialUserModelData(body)

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de progreso son inválidos',
                validationResult.error.issues
            )

        const auth = authenticatedUser(req)

        const { successfully, message, data } = await UserModelModel.update(
            +id,
            auth.userId,
            validationResult.data
        )

        if (!successfully)
            throw new AppError(
                message === 'User Model not found' ? 404 : 500,
                message === 'User Model not found'
                    ? 'PROGRESS_NOT_FOUND'
                    : 'PROGRESS_UPDATE_FAILED',
                message === 'User Model not found'
                    ? 'No se encontró el progreso'
                    : 'No se pudo actualizar el progreso'
            )

        return res.json({ successfully, message, data })
    }

    static async delete(req: Request, res: Response) {
        const { modelId } = req.params
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully, message } = await UserModelModel.delete(
            userId,
            +modelId
        )
        if (!successfully)
            throw new AppError(
                500,
                'PROGRESS_DELETE_FAILED',
                'No se pudo eliminar el progreso'
            )
        return res.send({ successfully, message })
    }
}
