import type { Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { authenticatedUser } from '../middleware/auth.js'
import { AuthModel } from '../models/auth.js'
import { AuthSessionModel } from '../models/authSessions.js'
import { loginSchema } from '../schemas/auth.js'

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
        return response.json({
            data: {
                user,
                access_token: session.token,
                token_type: 'Bearer',
                expires_at: session.expiresAt,
            },
        })
    }

    static async logout(request: Request, response: Response) {
        const auth = authenticatedUser(request)
        await AuthSessionModel.revoke(auth.token)
        return response.status(204).send()
    }
}
