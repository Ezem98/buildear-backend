import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { authenticatedUser } from '../middleware/auth.js'
import { AuthModel } from '../models/auth.js'
import { AuthSessionModel } from '../models/authSessions.js'
import { UserModel } from '../models/users.js'
import { loginSchema, refreshSchema } from '../schemas/auth.js'

function sessionResponse(
    user: unknown,
    session: Awaited<ReturnType<typeof AuthSessionModel.create>>
) {
    return {
        data: {
            user,
            access_token: session.token,
            token_type: 'Bearer',
            expires_at: session.expiresAt,
            refresh_token: session.refreshToken,
            refresh_expires_at: session.refreshExpiresAt,
        },
    }
}

export class AuthController {
    static async login(request: Request, response: Response) {
        const validation = loginSchema.safeParse(request.body)
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos de login son inválidos',
                validation.error.issues
            )
        }

        const user = await AuthModel.login(
            validation.data.username,
            validation.data.password
        )
        if (!user) {
            throw new AppError(
                401,
                'INVALID_CREDENTIALS',
                'Usuario o contraseña incorrectos'
            )
        }

        const session = await AuthSessionModel.create(user.id)
        return response.json(sessionResponse(user, session))
    }

    static async refresh(request: Request, response: Response) {
        const validation = refreshSchema.safeParse(request.body)
        if (!validation.success) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Los datos para renovar la sesión son inválidos',
                validation.error.issues
            )
        }

        const rotation = await AuthSessionModel.rotate(
            validation.data.refresh_token
        )
        if (rotation.status === 'reused') {
            throw new AppError(
                401,
                'REFRESH_TOKEN_REUSED',
                'La sesión fue revocada por seguridad'
            )
        }
        if (rotation.status === 'invalid') {
            throw new AppError(
                401,
                'INVALID_REFRESH_TOKEN',
                'La sesión ya no se puede renovar'
            )
        }

        const user = await UserModel.getById(rotation.userId)
        if (!user) {
            await AuthSessionModel.revoke(rotation.session.token)
            throw new AppError(
                401,
                'INVALID_REFRESH_TOKEN',
                'Usuario no encontrado'
            )
        }

        return response.json(sessionResponse(user, rotation.session))
    }

    static async logout(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        await AuthSessionModel.revoke(auth.token)
        return response.status(204).send()
    }
}
