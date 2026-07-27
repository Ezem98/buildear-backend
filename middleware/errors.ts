import { randomUUID } from 'node:crypto'
import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response,
} from 'express'
import { AppError } from '../errors/appError.js'

export function requestContext(
    request: Request,
    response: Response,
    next: NextFunction
): void {
    request.requestId = request.header('x-request-id') ?? randomUUID()
    response.setHeader('x-request-id', request.requestId)
    next()
}

export function notFound(request: Request, _response: Response): never {
    throw new AppError(
        404,
        'ROUTE_NOT_FOUND',
        `No existe la ruta ${request.method} ${request.path}`
    )
}

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    request,
    response,
    _next
) => {
    const appError =
        error instanceof AppError
            ? error
            : new AppError(
                  500,
                  'INTERNAL_ERROR',
                  'Ocurrió un error interno inesperado'
              )

    if (appError.status >= 500) {
        console.error({
            code: appError.code,
            requestId: request.requestId,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown internal error',
        })
    }

    response.status(appError.status).json({
        error: {
            code: appError.code,
            message: appError.message,
            details: appError.details,
            requestId: request.requestId,
        },
    })
}
