import { rateLimit } from 'express-rate-limit'
import { AppError } from '../errors/appError.js'

function positiveInteger(name: string, fallback: number): number {
    const configured = Number(process.env[name])
    return Number.isInteger(configured) && configured > 0
        ? configured
        : fallback
}

function createRateLimiter(options: {
    windowMs: number
    limit: number
    code: string
    message: string
}) {
    return rateLimit({
        windowMs: options.windowMs,
        limit: options.limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_request, _response, next) => {
            next(new AppError(429, options.code, options.message))
        },
    })
}

export const loginRateLimit = createRateLimiter({
    windowMs: positiveInteger('AUTH_LOGIN_WINDOW_MS', 15 * 60 * 1000),
    limit: positiveInteger('AUTH_LOGIN_LIMIT', 10),
    code: 'LOGIN_RATE_LIMITED',
    message: 'Demasiados intentos de login; intentá nuevamente más tarde',
})

export const registrationRateLimit = createRateLimiter({
    windowMs: positiveInteger('AUTH_REGISTRATION_WINDOW_MS', 60 * 60 * 1000),
    limit: positiveInteger('AUTH_REGISTRATION_LIMIT', 5),
    code: 'REGISTRATION_RATE_LIMITED',
    message: 'Demasiados registros desde este origen',
})

export const passwordRateLimit = createRateLimiter({
    windowMs: positiveInteger('AUTH_PASSWORD_WINDOW_MS', 60 * 60 * 1000),
    limit: positiveInteger('AUTH_PASSWORD_LIMIT', 5),
    code: 'PASSWORD_RATE_LIMITED',
    message: 'Demasiados intentos de cambio de contraseña',
})

export const openAIRateLimit = createRateLimiter({
    windowMs: positiveInteger('OPENAI_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    limit: positiveInteger('OPENAI_RATE_LIMIT', 30),
    code: 'OPENAI_RATE_LIMITED',
    message: 'Se alcanzó el límite temporal de solicitudes de IA',
})
