import type { NextFunction, Request, Response } from 'express'

export function securityHeaders(
    _request: Request,
    response: Response,
    next: NextFunction
): void {
    response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    )
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()'
    )
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    next()
}

export function legacyApiHeaders(
    _request: Request,
    response: Response,
    next: NextFunction
): void {
    response.setHeader('Deprecation', 'true')
    response.setHeader('Link', '</api/v1>; rel="successor-version"')
    next()
}
