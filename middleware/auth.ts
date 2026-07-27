import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/appError.js'
import { AuthSessionModel } from '../models/authSessions.js'
import type { UserRole } from '../types/user.js'

function bearerToken(request: Request): string | undefined {
    const authorization = request.header('authorization')
    if (!authorization) return undefined

    const [scheme, token, extra] = authorization.trim().split(/\s+/)
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) return undefined
    return token
}

export async function requireAuth(
    request: Request,
    _response: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = bearerToken(request)
        if (!token) {
            throw new AppError(
                401,
                'AUTH_REQUIRED',
                'Se requiere autenticación'
            )
        }

        const session = await AuthSessionModel.authenticate(token)
        if (!session) {
            throw new AppError(
                401,
                'INVALID_SESSION',
                'La sesión es inválida o expiró'
            )
        }

        request.auth = {
            userId: Number(session.user_id),
            username: String(session.username),
            role: String(session.role) as UserRole,
            token,
        }
        next()
    } catch (error) {
        next(error)
    }
}

export function authenticatedUser(request: Request) {
    if (!request.auth) {
        throw new AppError(
            500,
            'AUTH_CONTEXT_MISSING',
            'No se pudo resolver la identidad autenticada'
        )
    }
    return request.auth
}

export function requireAdmin(
    request: Request,
    _response: Response,
    next: NextFunction
): void {
    try {
        const auth = authenticatedUser(request)
        if (auth.role !== 'admin') {
            throw new AppError(
                403,
                'ADMIN_REQUIRED',
                'Se requieren permisos de administración'
            )
        }

        next()
    } catch (error) {
        next(error)
    }
}

export function assertOwnedUserId(
    request: Request,
    candidate: unknown
): number {
    const auth = authenticatedUser(request)
    const userId = Number(candidate)

    if (!Number.isInteger(userId) || userId <= 0) {
        throw new AppError(400, 'INVALID_USER_ID', 'El userId es inválido')
    }
    if (userId !== auth.userId) {
        throw new AppError(
            403,
            'FORBIDDEN_RESOURCE',
            'No tenés permiso para acceder a recursos de otro usuario'
        )
    }
    return userId
}

export function assertOwnedUsername(
    request: Request,
    username: unknown
): string {
    const auth = authenticatedUser(request)
    if (username !== auth.username) {
        throw new AppError(
            403,
            'FORBIDDEN_RESOURCE',
            'No tenés permiso para acceder a otro usuario'
        )
    }
    return auth.username
}
