import type { UserRole } from './user.js'

export interface AuthContext {
    userId: number
    username: string
    role: UserRole
    token: string
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext
            requestId: string
        }
    }
}
