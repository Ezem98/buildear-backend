import { db } from '../utils/consts.js'

export class ConversationModel {
    static async create(userId: number) {
        return (
            await db.execute({
                sql: `
                    INSERT INTO conversations (user_id)
                    VALUES (?)
                    RETURNING *
                `,
                args: [userId],
            })
        ).rows[0]
    }

    static async get(id: number, userId: number) {
        return (
            await db.execute({
                sql: `
                    SELECT *
                    FROM conversations
                    WHERE id = ? AND user_id = ?
                `,
                args: [id, userId],
            })
        ).rows[0]
    }

    static async getAllByUserId(userId: number) {
        return (
            await db.execute({
                sql: `
                    SELECT *
                    FROM conversations
                    WHERE user_id = ?
                    ORDER BY COALESCE(last_message_at, created_at) DESC
                `,
                args: [userId],
            })
        ).rows
    }

    static async delete(id: number, userId: number): Promise<boolean> {
        const transaction = await db.transaction('write')
        try {
            const conversation = (
                await transaction.execute({
                    sql: `
                        SELECT id
                        FROM conversations
                        WHERE id = ? AND user_id = ?
                    `,
                    args: [id, userId],
                })
            ).rows[0]
            if (!conversation) {
                await transaction.rollback()
                return false
            }

            await transaction.execute({
                sql: 'DELETE FROM conversation_messages WHERE conversation_id = ?',
                args: [id],
            })
            await transaction.execute({
                sql: 'DELETE FROM conversations WHERE id = ? AND user_id = ?',
                args: [id, userId],
            })
            await transaction.commit()
            return true
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }
}
