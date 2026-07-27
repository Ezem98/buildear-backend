import type { IConversationMessage } from '../types/conversationMessage.js'
import { db } from '../utils/consts.js'

export class ConversationMessageModel {
    static async create(newMessage: IConversationMessage, userId: number) {
        const { conversation_id, message, sender } = newMessage

        const row = (
            await db.execute({
                sql: `
                    INSERT INTO conversation_messages (
                        conversation_id,
                        message,
                        sender
                    )
                    SELECT ?, ?, ?
                    WHERE EXISTS (
                        SELECT 1
                        FROM conversations
                        WHERE id = ? AND user_id = ?
                    )
                    RETURNING *
                `,
                args: [
                    conversation_id,
                    message,
                    sender,
                    conversation_id,
                    userId,
                ],
            })
        ).rows[0]

        if (row) {
            await db.execute({
                sql: `
                    UPDATE conversations
                    SET
                        last_message_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                `,
                args: [conversation_id, userId],
            })
        }

        return row
    }

    static async createAll(messages: IConversationMessage[], userId: number) {
        if (messages.length === 0) return []
        const conversationId = messages[0].conversation_id
        if (
            messages.some(
                (message) => message.conversation_id !== conversationId
            )
        ) {
            return undefined
        }

        const transaction = await db.transaction('write')
        try {
            const conversation = (
                await transaction.execute({
                    sql: `
                        SELECT id
                        FROM conversations
                        WHERE id = ? AND user_id = ?
                    `,
                    args: [conversationId, userId],
                })
            ).rows[0]
            if (!conversation) {
                await transaction.rollback()
                return undefined
            }

            const created = []
            for (const message of messages) {
                const row = (
                    await transaction.execute({
                        sql: `
                            INSERT INTO conversation_messages (
                                conversation_id,
                                message,
                                sender
                            )
                            VALUES (?, ?, ?)
                            RETURNING *
                        `,
                        args: [
                            message.conversation_id,
                            message.message,
                            message.sender,
                        ],
                    })
                ).rows[0]
                created.push(row)
            }

            await transaction.execute({
                sql: `
                    UPDATE conversations
                    SET
                        last_message_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                `,
                args: [conversationId, userId],
            })
            await transaction.commit()
            return created
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }

    static async get(id: number, userId: number) {
        return (
            await db.execute({
                sql: `
                    SELECT m.*
                    FROM conversation_messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.id = ? AND c.user_id = ?
                `,
                args: [id, userId],
            })
        ).rows[0]
    }

    static async getAllByConversationId(
        conversationId: number,
        userId: number
    ) {
        return (
            await db.execute({
                sql: `
                    SELECT m.*
                    FROM conversation_messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.conversation_id = ? AND c.user_id = ?
                    ORDER BY m.created_at ASC, m.id ASC
                `,
                args: [conversationId, userId],
            })
        ).rows
    }

    static async delete(id: number, userId: number): Promise<boolean> {
        const result = await db.execute({
            sql: `
                DELETE FROM conversation_messages
                WHERE id = ? AND conversation_id IN (
                    SELECT id
                    FROM conversations
                    WHERE user_id = ?
                )
            `,
            args: [id, userId],
        })
        return result.rowsAffected === 1
    }
}
