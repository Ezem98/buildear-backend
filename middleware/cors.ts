import type { CorsOptions } from 'cors'
import { AppError } from '../errors/appError.js'

function allowedOrigins(): Set<string> {
    const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)

    if (configured.length > 0) return new Set(configured)
    if (process.env.NODE_ENV === 'production') return new Set()

    return new Set(['http://localhost:3000', 'http://localhost:5173'])
}

export const corsOptions: CorsOptions = {
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
        if (!origin || allowedOrigins().has(origin)) {
            callback(null, true)
            return
        }

        callback(
            new AppError(
                403,
                'CORS_ORIGIN_DENIED',
                'El origen de la solicitud no está permitido'
            )
        )
    },
}
