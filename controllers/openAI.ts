import { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { authenticatedUser } from '../middleware/auth.js'
import { OpenAIModel } from '../models/openAI.js'
import { validOpenAIData, validOpenAIMessageData } from '../schemas/openAI.js'

export class OpenAIController {
    static async generateStepsWithOpenAI(req: Request, res: Response) {
        const { body } = req
        const auth = authenticatedUser(req)
        const validationResult = validOpenAIData(body)

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos para generar la guía son inválidos',
                validationResult.error.issues
            )

        const { successfully, message, data } =
            await OpenAIModel.generateStepsWithOpenAI(
                validationResult.data,
                auth.userId
            )

        if (!successfully)
            throw new AppError(
                502,
                'OPENAI_GUIDE_FAILED',
                'No se pudo generar la guía'
            )

        return res.json({ message, successfully, data })
    }

    static async responseMessage(req: Request, res: Response) {
        const validationResult = validOpenAIMessageData(req.body)
        const auth = authenticatedUser(req)

        if (!validationResult.success)
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'El mensaje es inválido',
                validationResult.error.issues
            )

        const { successfully, message, data } =
            await OpenAIModel.responseMessage(
                validationResult.data.message,
                auth.userId
            )

        if (!successfully)
            throw new AppError(
                502,
                'OPENAI_MESSAGE_FAILED',
                'No se pudo generar la respuesta'
            )

        return res.json({ message, successfully, data })
    }
}
