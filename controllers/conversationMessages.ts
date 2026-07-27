import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { authenticatedUser } from '../middleware/auth.js'
import { ConversationMessageModel } from '../models/conversationMessages.js'
import {
    validConversationMessageData,
    validConversationMessageListData,
} from '../schemas/conversationMessage.js'

function positiveId(value: unknown): number {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(400, 'INVALID_ID', 'El identificador es inválido')
    }
    return id
}

export class ConversationMessageController {
    static async create(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const validation = validConversationMessageData(request.body)
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos del mensaje son inválidos',
                validation.error.issues
            )
        }

        const message = await ConversationMessageModel.create(
            validation.data,
            auth.userId
        )
        if (!message) {
            throw new AppError(
                404,
                'CONVERSATION_NOT_FOUND',
                'Conversación no encontrada'
            )
        }
        return response.status(201).json({ data: message })
    }

    static async createAll(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const validation = validConversationMessageListData(request.body)
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'La lista de mensajes es inválida',
                validation.error.issues
            )
        }

        const messages = await ConversationMessageModel.createAll(
            validation.data.messages,
            auth.userId
        )
        if (!messages) {
            throw new AppError(
                404,
                'CONVERSATION_NOT_FOUND',
                'Conversación no encontrada'
            )
        }
        return response.status(201).json({ data: messages })
    }

    static async get(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const message = await ConversationMessageModel.get(
            positiveId(request.params.id),
            auth.userId
        )
        if (!message) {
            throw new AppError(
                404,
                'MESSAGE_NOT_FOUND',
                'Mensaje no encontrado'
            )
        }
        return response.json({ data: message })
    }

    static async getAllByConversationId(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const messages = await ConversationMessageModel.getAllByConversationId(
            positiveId(request.params.conversationId),
            auth.userId
        )
        return response.json({ data: messages })
    }

    static async delete(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const deleted = await ConversationMessageModel.delete(
            positiveId(request.params.id),
            auth.userId
        )
        if (!deleted) {
            throw new AppError(
                404,
                'MESSAGE_NOT_FOUND',
                'Mensaje no encontrado'
            )
        }
        return response.status(204).send()
    }
}
