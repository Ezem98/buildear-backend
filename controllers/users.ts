import type { Request, Response } from 'express'
import { ExperienceLevel } from '../enums/experienceLevel.js'
import { AppError } from '../errors/appError.js'
import { assertOwnedUsername, authenticatedUser } from '../middleware/auth.js'
import { AuthSessionModel } from '../models/authSessions.js'
import { UserModel } from '../models/users.js'
import {
    validPartialUserData,
    validUpdatePasswordData,
    validUserData,
} from '../schemas/users.js'

function conflictError(error: unknown): never {
    if (
        error instanceof Error &&
        /UNIQUE constraint failed/i.test(error.message)
    ) {
        throw new AppError(
            409,
            'USER_CONFLICT',
            'El username o email ya está registrado'
        )
    }
    throw error
}

export class UserController {
    static async getAll(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const user = await UserModel.getById(auth.userId)
        return response.json({ data: user ? [user] : [] })
    }

    static async getMe(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const user = await UserModel.getById(auth.userId)
        if (!user) {
            throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
        }
        return response.json({ data: user })
    }

    static async getByUsername(request: Request, response: Response) {
        const username = assertOwnedUsername(request, request.params.username)
        const user = await UserModel.getByUsername(username)
        if (!user) {
            throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
        }
        return response.json({ data: user })
    }

    static async create(request: Request, response: Response) {
        const validation = validUserData({
            ...request.body,
            experience_level: ExperienceLevel.BEGINNER,
        })
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Revisá los datos ingresados',
                validation.error.issues
            )
        }

        try {
            const user = await UserModel.create(validation.data)
            return response.status(201).json({ data: user })
        } catch (error) {
            return conflictError(error)
        }
    }

    static async update(request: Request, response: Response) {
        assertOwnedUsername(request, request.params.username)
        const auth = authenticatedUser(request)
        const validation = validPartialUserData(request.body)

        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de usuario son inválidos',
                validation.error.issues
            )
        }

        try {
            const user = await UserModel.update(auth.userId, validation.data)
            if (!user) {
                throw new AppError(
                    404,
                    'USER_NOT_FOUND',
                    'Usuario no encontrado'
                )
            }
            return response.json({ data: user })
        } catch (error) {
            return conflictError(error)
        }
    }

    static async changePassword(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        const validation = validUpdatePasswordData(request.body)

        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de contraseña son inválidos',
                validation.error.issues
            )
        }

        const changed = await UserModel.changePassword(
            auth.userId,
            validation.data.password,
            validation.data.newPassword
        )
        if (!changed) {
            throw new AppError(
                401,
                'INVALID_CURRENT_PASSWORD',
                'La contraseña actual es incorrecta'
            )
        }

        await AuthSessionModel.revokeAllForUser(auth.userId)
        return response.status(204).send()
    }

    static async delete(request: Request, response: Response) {
        assertOwnedUsername(request, request.params.username)
        const auth = authenticatedUser(request)
        const deleted = await UserModel.delete(auth.userId)
        if (!deleted) {
            throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
        }
        return response.status(204).send()
    }
}
