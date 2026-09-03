import type { Row, Transaction } from '@libsql/client'
import { createHash, randomBytes } from 'node:crypto'
import { db } from '../utils/consts.js'

const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

function tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

function sqliteTimestamp(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ')
}

function dateWithoutMilliseconds(timestamp: number): Date {
    return new Date(Math.floor(timestamp / 1000) * 1000)
}

function positiveInteger(name: string, fallback: number): number {
    const configured = Number(process.env[name])
    return Number.isInteger(configured) && configured > 0
        ? configured
        : fallback
}

function accessTtlSeconds(): number {
    return positiveInteger(
        'AUTH_ACCESS_TTL_SECONDS',
        positiveInteger('AUTH_SESSION_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS)
    )
}

function refreshTtlSeconds(): number {
    return positiveInteger(
        'AUTH_REFRESH_TTL_SECONDS',
        DEFAULT_REFRESH_TTL_SECONDS
    )
}

export interface CreatedSession {
    token: string
    expiresAt: string
    refreshToken: string
    refreshExpiresAt: string
}

export type RotateSessionResult =
    | { status: 'ok'; userId: number; session: CreatedSession }
    | { status: 'invalid' }
    | { status: 'reused' }

async function insertSession(
    transaction: Transaction,
    userId: number,
    family: string,
    refreshExpiresAt?: Date
): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url')
    const refreshToken = randomBytes(48).toString('base64url')
    const now = Date.now()
    const expiresAt = dateWithoutMilliseconds(now + accessTtlSeconds() * 1000)
    const effectiveRefreshExpiry =
        refreshExpiresAt ??
        dateWithoutMilliseconds(now + refreshTtlSeconds() * 1000)

    await transaction.execute({
        sql: `
            INSERT INTO auth_sessions (
                user_id,
                token_hash,
                expires_at,
                refresh_token_hash,
                refresh_expires_at,
                session_family
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
            userId,
            tokenHash(token),
            sqliteTimestamp(expiresAt),
            tokenHash(refreshToken),
            sqliteTimestamp(effectiveRefreshExpiry),
            family,
        ],
    })

    return {
        token,
        expiresAt: expiresAt.toISOString(),
        refreshToken,
        refreshExpiresAt: effectiveRefreshExpiry.toISOString(),
    }
}

function rowDate(row: Row, column: string): Date | undefined {
    const value = row[column]
    if (value === null || value === undefined) return undefined
    const parsed = new Date(`${String(value).replace(' ', 'T')}Z`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export class AuthSessionModel {
    static async create(userId: number): Promise<CreatedSession> {
        const transaction = await db.transaction('write')
        try {
            const session = await insertSession(
                transaction,
                userId,
                randomBytes(16).toString('hex')
            )
            await transaction.commit()
            return session
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }

    static async rotate(refreshToken: string): Promise<RotateSessionResult> {
        const transaction = await db.transaction('write')
        try {
            const refreshHash = tokenHash(refreshToken)
            const row = (
                await transaction.execute({
                    sql: `
                        SELECT
                            user_id,
                            refresh_expires_at,
                            session_family,
                            revoked_at,
                            rotated_at
                        FROM auth_sessions
                        WHERE refresh_token_hash = ?
                        LIMIT 1
                    `,
                    args: [refreshHash],
                })
            ).rows[0]

            if (!row) {
                await transaction.rollback()
                return { status: 'invalid' }
            }

            const family =
                row.session_family === null
                    ? undefined
                    : String(row.session_family)
            if (row.rotated_at !== null || row.revoked_at !== null) {
                if (family) {
                    await transaction.execute({
                        sql: `
                            UPDATE auth_sessions
                            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
                            WHERE session_family = ?
                        `,
                        args: [family],
                    })
                    await transaction.commit()
                } else {
                    await transaction.rollback()
                }
                return { status: 'reused' }
            }

            const refreshExpiresAt = rowDate(row, 'refresh_expires_at')
            if (
                !family ||
                !refreshExpiresAt ||
                refreshExpiresAt <= new Date()
            ) {
                await transaction.execute({
                    sql: `
                        UPDATE auth_sessions
                        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
                        WHERE refresh_token_hash = ?
                    `,
                    args: [refreshHash],
                })
                await transaction.commit()
                return { status: 'invalid' }
            }

            await transaction.execute({
                sql: `
                    UPDATE auth_sessions
                    SET
                        revoked_at = CURRENT_TIMESTAMP,
                        rotated_at = CURRENT_TIMESTAMP
                    WHERE refresh_token_hash = ?
                      AND revoked_at IS NULL
                      AND rotated_at IS NULL
                `,
                args: [refreshHash],
            })

            const userId = Number(row.user_id)
            const session = await insertSession(
                transaction,
                userId,
                family,
                refreshExpiresAt
            )
            await transaction.commit()
            return { status: 'ok', userId, session }
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
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
        const row = (
            await db.execute({
                sql: `
                    SELECT session_family
                    FROM auth_sessions
                    WHERE token_hash = ?
                    LIMIT 1
                `,
                args: [tokenHash(token)],
            })
        ).rows[0]
        const family = row?.session_family
        if (family) {
            await db.execute({
                sql: `
                    UPDATE auth_sessions
                    SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
                    WHERE session_family = ?
                `,
                args: [String(family)],
            })
            return
        }

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
                SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
                WHERE user_id = ?
            `,
            args: [userId],
        })
    }
}
