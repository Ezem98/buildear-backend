import { createHash, randomBytes } from 'node:crypto'
import { db } from '../utils/consts.js'

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60

function tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

function sqliteTimestamp(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ')
}

function sessionTtlSeconds(): number {
    const configured = Number(process.env.AUTH_SESSION_TTL_SECONDS)
    return Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_SESSION_TTL_SECONDS
}

export class AuthSessionModel {
    static async create(userId: number) {
        const token = randomBytes(32).toString('base64url')
        const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000)

        await db.execute({
            sql: `
                INSERT INTO auth_sessions (user_id, token_hash, expires_at)
                VALUES (?, ?, ?)
            `,
            args: [userId, tokenHash(token), sqliteTimestamp(expiresAt)],
        })

        return {
            token,
            expiresAt: expiresAt.toISOString(),
        }
    }

    static async authenticate(token: string) {
        return (
            await db.execute({
                sql: `
                    SELECT
                        s.user_id,
                        u.username,
                        u.role
                    FROM auth_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE
                        s.token_hash = ?
                        AND s.revoked_at IS NULL
                        AND s.expires_at > CURRENT_TIMESTAMP
                    LIMIT 1
                `,
                args: [tokenHash(token)],
            })
        ).rows[0]
    }

    static async revoke(token: string): Promise<void> {
        await db.execute({
            sql: `
                UPDATE auth_sessions
                SET revoked_at = CURRENT_TIMESTAMP
                WHERE token_hash = ? AND revoked_at IS NULL
            `,
            args: [tokenHash(token)],
        })
    }

    static async revokeAllForUser(userId: number): Promise<void> {
        await db.execute({
            sql: `
                UPDATE auth_sessions
                SET revoked_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND revoked_at IS NULL
            `,
            args: [userId],
        })
    }
}
