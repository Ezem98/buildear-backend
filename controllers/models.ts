import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { assertOwnedUserId } from '../middleware/auth.js'
import { ModelModel } from '../models/models.js'
import { validModelData, validPartialModelData } from '../schemas/models.js'
import {
    validateImageUpload,
    validateModelUpload,
    type ValidatedUpload,
} from '../services/uploads.js'

function optionalNumber(value: unknown): unknown {
    return value === undefined ? undefined : Number(value)
}

function normalizedModelBody(
    request: Request,
    modelData?: ValidatedUpload<string>,
    modelImage?: ValidatedUpload<string>
) {
    const {
        categoryId,
        difficultyRating,
        data: _data,
        image: _image,
        ...body
    } = request.body

    return {
        ...body,
        data: modelData?.path,
        image: modelImage?.path,
        width: optionalNumber(body.width),
        height: optionalNumber(body.height),
        category_id: optionalNumber(body.category_id ?? categoryId),
        difficulty_rating: optionalNumber(
            body.difficulty_rating ?? difficultyRating
        ),
    }
}

function modelReadError(message: string): AppError {
    if (message.toLowerCase().includes('not found')) {
        return new AppError(404, 'MODEL_NOT_FOUND', 'No se encontró el modelo')
    }

    return new AppError(
        500,
        'MODEL_READ_FAILED',
        'No se pudieron consultar los modelos'
    )
}

export class ModelController {
    static async getAll(req: Request, res: Response) {
        const { successfully, message, data } = await ModelModel.getAll()

        if (!successfully) throw modelReadError(message)

        res.json({ message, data })
    }

    static async getById(req: Request, res: Response) {
        const { id } = req.params

        const { successfully, message, data } = await ModelModel.getById(+id)

        if (!successfully) throw modelReadError(message)
        return res.json({ message, data })
    }

    static async getByCategoryId(req: Request, res: Response) {
        const { categoryId } = req.params

        const { successfully, message, data } =
            await ModelModel.getByCategoryId(+categoryId)

        if (!successfully) throw modelReadError(message)
        return res.json({ message, data })
    }

    static async getByName(req: Request, res: Response) {
        const { search } = req.params

        const { successfully, message, data } = await ModelModel.getByName(
            String(search)
        )

        if (!successfully) throw modelReadError(message)
        return res.json({ successfully, message, data })
    }

    static async getByUserId(req: Request, res: Response) {
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully, message, data } = await ModelModel.getByUserId(
            String(userId)
        )

        if (!successfully) throw modelReadError(message)
        return res.json({ successfully, message, data })
    }

    static async getFavorites(req: Request, res: Response) {
        const userId = assertOwnedUserId(req, req.params.userId)

        const { successfully, message, data } = await ModelModel.getFavorites(
            String(userId)
        )

        if (!successfully) throw modelReadError(message)
        return res.json({ successfully, message, data })
    }

    static async create(req: Request, res: Response) {
        const { files } = req
        if (!files || Object.keys(files).length === 0)
            throw new AppError(
                400,
                'MODEL_FILE_REQUIRED',
                'No se encontró ningún archivo'
            )

        const modelData = await validateModelUpload(req.files?.modelData, true)
        const modelImage = await validateImageUpload(
            req.files?.modelImage,
            true
        )
        const validationResult = validModelData(
            normalizedModelBody(req, modelData, modelImage)
        )

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos del modelo son inválidos',
                validationResult.error.issues
            )

        const { successfully, message, data } = await ModelModel.create(
            validationResult.data,
            {
                modelData: modelData!,
                modelImage: modelImage!,
            }
        )

        if (!successfully)
            throw new AppError(
                500,
                'MODEL_CREATE_FAILED',
                'No se pudo crear el modelo'
            )

        return res.status(201).json({ message, data })
    }

    static async update(req: Request, res: Response) {
        const { id } = req.params
        const modelData = await validateModelUpload(req.files?.modelData, false)
        const modelImage = await validateImageUpload(
            req.files?.modelImage,
            false
        )
        const validationResult = validPartialModelData(
            normalizedModelBody(req, modelData, modelImage)
        )

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos del modelo son inválidos',
                validationResult.error.issues
            )

        const { successfully, message, data } = await ModelModel.update(
            +id,
            validationResult.data,
            { modelData, modelImage }
        )

        if (!successfully)
            throw new AppError(
                message === 'Model not found' ? 404 : 400,
                message === 'Model not found'
                    ? 'MODEL_NOT_FOUND'
                    : 'MODEL_UPDATE_FAILED',
                message === 'Model not found'
                    ? 'No se encontró el modelo'
                    : 'No se pudo actualizar el modelo'
            )

        return res.json({ message, data })
    }

    static async delete(req: Request, res: Response) {
        const { id } = req.params

        const { successfully, message } = await ModelModel.delete(+id)
        if (!successfully)
            throw new AppError(
                500,
                'MODEL_DELETE_FAILED',
                'No se pudo eliminar el modelo'
            )
        return res.send({ message })
    }
}
