import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { authenticatedUser } from '../middleware/auth.js'
import { ModelModel } from '../models/models.js'
import { OpenAIModel } from '../models/openAI.js'
import { validOpenAIData, validOpenAIMessageData } from '../schemas/openAI.js'

export class OpenAIController {
    static async generateStepsWithOpenAI(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const validation = validOpenAIData(request.body)

        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos para generar la guía son inválidos',
                validation.error.issues
            )
        }

        const { model_id: modelId, ...openAIInput } = validation.data
        const model = await ModelModel.getById(modelId)
        if (!model.successfully) {
            throw new AppError(
                404,
                'MODEL_NOT_FOUND',
                'No se encontró el modelo'
            )
        }

        const { successfully, message, data } =
            await OpenAIModel.generateStepsWithOpenAI(
                openAIInput,
                auth.userId,
                modelId
            )

        if (!successfully) {
            throw new AppError(
                502,
                'OPENAI_GUIDE_FAILED',
                'No se pudo generar o guardar la guía'
            )
        }

        return response.json({
            message,
            successfully,
            data: data?.guide,
            user_model: data?.userModel,
        })
    }

    static async responseMessage(request: Request, response: Response) {
        const validation = validOpenAIMessageData(request.body)
        const auth = authenticatedUser(request)

        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'El mensaje es inválido',
                validation.error.issues
            )
        }

        const { successfully, message, data } =
            await OpenAIModel.responseMessage(
                validation.data.message,
                auth.userId,
                validation.data.conversation_id
            )

        if (!successfully) {
            if (message === 'Conversation not found') {
                throw new AppError(
                    404,
                    'CONVERSATION_NOT_FOUND',
                    'Conversación no encontrada'
                )
            }

            throw new AppError(
                502,
                'OPENAI_MESSAGE_FAILED',
                'No se pudo generar la respuesta',
                data
                    ? {
                          conversation_id: data.conversation.id,
                          user_message_id: data.userMessage.id,
                          assistant_message_id: data.assistantMessage?.id,
                      }
                    : undefined
            )
        }

        return response.json({
            message,
            successfully,
            data: data?.answer,
            conversation_id: data?.conversation.id,
            conversation: data?.conversation,
            user_message: data?.userMessage,
            assistant_message: data?.assistantMessage,
        })
    }
}
