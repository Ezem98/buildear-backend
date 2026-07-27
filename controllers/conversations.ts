import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { assertOwnedUserId, authenticatedUser } from '../middleware/auth.js'
import { ConversationModel } from '../models/conversations.js'
import { validConversationData } from '../schemas/conversation.js'

function positiveId(value: unknown): number {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(400, 'INVALID_ID', 'El identificador es inválido')
    }
    return id
}

export class ConversationController {
    static async create(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const validation = validConversationData(request.body)
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de conversación son inválidos',
                validation.error.issues
            )
        }
        if (validation.data.user_id !== undefined) {
            assertOwnedUserId(request, validation.data.user_id)
        }

        const conversation = await ConversationModel.create(auth.userId)
        return response.status(201).json({ data: conversation })
    }

    static async get(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const conversation = await ConversationModel.get(
            positiveId(request.params.id),
            auth.userId
        )
        if (!conversation) {
            throw new AppError(
                404,
                'CONVERSATION_NOT_FOUND',
                'Conversación no encontrada'
            )
        }
        return response.json({ data: conversation })
    }

    static async getAllByUserId(request: Request, response: Response) {
        const userId = assertOwnedUserId(request, request.params.userId)
        const conversations = await ConversationModel.getAllByUserId(userId)
        return response.json({ data: conversations })
    }

    static async delete(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const deleted = await ConversationModel.delete(
            positiveId(request.params.id),
            auth.userId
        )
        if (!deleted) {
            throw new AppError(
                404,
                'CONVERSATION_NOT_FOUND',
                'Conversación no encontrada'
            )
        }
        return response.status(204).send()
    }
}
