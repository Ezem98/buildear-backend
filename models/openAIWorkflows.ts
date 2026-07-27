import type { Row } from '@libsql/client'
import type { ChatContextMessage, OpenAIMetadata } from '../services/openAI.js'
import type { IGuide } from '../types/guide.js'
import { db } from '../utils/consts.js'
import { AiGenerationModel } from './aiGenerations.js'
import {
    CHAT_CONTEXT_CHARACTER_LIMIT,
    CHAT_CONTEXT_MESSAGE_LIMIT,
} from './conversationMessages.js'

export interface StartedChatTurn {
    conversation: Row
    userMessage: Row
    context: ChatContextMessage[]
}

export interface FinishedChatTurn {
    conversation: Row
    assistantMessage: Row
}

function contextFromRows(rows: Row[]): ChatContextMessage[] {
    const selected: ChatContextMessage[] = []
    let remainingCharacters = CHAT_CONTEXT_CHARACTER_LIMIT

    for (const row of rows) {
        if (row.sender !== 'user' && row.sender !== 'assistant') continue

        const content = String(row.message).trim()
        if (!content) continue

        const boundedContent = content.slice(0, remainingCharacters)
        if (!boundedContent) break

        selected.push({
            role: row.sender,
            content: boundedContent,
        })
        remainingCharacters -= boundedContent.length
        if (remainingCharacters === 0) break
    }

    return selected.reverse()
}

export class OpenAIWorkflowModel {
    static async saveGeneratedGuide(
        userId: number,
        modelId: number,
        guide: IGuide,
        metadata: OpenAIMetadata
    ): Promise<Row | undefined> {
        const transaction = await db.transaction('write')
        try {
            const model = (
                await transaction.execute({
                    sql: 'SELECT id FROM models WHERE id = ?',
                    args: [modelId],
                })
            ).rows[0]
            if (!model) {
                await transaction.rollback()
                return undefined
            }

            const userModel = (
                await transaction.execute({
                    sql: `
                        INSERT INTO user_models (
                            user_id,
                            model_id,
                            completed,
                            current_step,
                            guide,
                            generation_status,
                            openai_response_id,
                            openai_model,
                            prompt_version,
                            generated_at
                        )
                        VALUES (?, ?, 0, 0, ?, 'completed', ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(user_id, model_id) DO UPDATE SET
                            guide = excluded.guide,
                            generation_status = excluded.generation_status,
                            openai_response_id = excluded.openai_response_id,
                            openai_model = excluded.openai_model,
                            prompt_version = excluded.prompt_version,
                            generated_at = excluded.generated_at,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING *
                    `,
                    args: [
                        userId,
                        modelId,
                        JSON.stringify(guide),
                        metadata.responseId ?? null,
                        metadata.model,
                        metadata.promptVersion,
                    ],
                })
            ).rows[0]

            await AiGenerationModel.record(
                userId,
                'guide',
                metadata,
                transaction
            )
            await transaction.commit()
            return userModel
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }

    static async saveGuideFailure(
        userId: number,
        modelId: number,
        metadata: OpenAIMetadata
    ): Promise<void> {
        const transaction = await db.transaction('write')
        try {
            await transaction.execute({
                sql: `
                    UPDATE user_models
                    SET
                        generation_status = 'failed',
                        openai_response_id = ?,
                        openai_model = ?,
                        prompt_version = ?,
                        generated_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND model_id = ?
                `,
                args: [
                    metadata.responseId ?? null,
                    metadata.model,
                    metadata.promptVersion,
                    userId,
                    modelId,
                ],
            })
            await AiGenerationModel.record(
                userId,
                'guide',
                metadata,
                transaction
            )
            await transaction.commit()
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }

    static async startChatTurn(
        userId: number,
        message: string,
        conversationId?: number
    ): Promise<StartedChatTurn | undefined> {
        const transaction = await db.transaction('write')
        try {
            let conversation: Row | undefined
            if (conversationId === undefined) {
                conversation = (
                    await transaction.execute({
                        sql: `
                            INSERT INTO conversations (user_id, title)
                            VALUES (?, ?)
                            RETURNING *
                        `,
                        args: [userId, message.slice(0, 120)],
                    })
                ).rows[0]
            } else {
                conversation = (
                    await transaction.execute({
                        sql: `
                            SELECT *
                            FROM conversations
                            WHERE id = ? AND user_id = ?
                        `,
                        args: [conversationId, userId],
                    })
                ).rows[0]
            }

            if (!conversation) {
                await transaction.rollback()
                return undefined
            }

            const id = Number(conversation.id)
            const contextRows = (
                await transaction.execute({
                    sql: `
                        SELECT message, sender
                        FROM conversation_messages
                        WHERE conversation_id = ?
                        ORDER BY created_at DESC, id DESC
                        LIMIT ?
                    `,
                    args: [id, CHAT_CONTEXT_MESSAGE_LIMIT],
                })
            ).rows

            const userMessage = (
                await transaction.execute({
                    sql: `
                        INSERT INTO conversation_messages (
                            conversation_id,
                            message,
                            sender,
                            status
                        )
                        VALUES (?, ?, 'user', 'completed')
                        RETURNING *
                    `,
                    args: [id, message],
                })
            ).rows[0]

            await transaction.execute({
                sql: `
                    UPDATE conversations
                    SET
                        last_message_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                `,
                args: [id, userId],
            })
            await transaction.commit()

            return {
                conversation,
                userMessage,
                context: contextFromRows(contextRows),
            }
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }

    static async finishChatTurn(
        userId: number,
        conversationId: number,
        answer: string,
        metadata: OpenAIMetadata
    ): Promise<FinishedChatTurn> {
        return this.saveAssistantMessage(
            userId,
            conversationId,
            answer,
            metadata
        )
    }

    static async failChatTurn(
        userId: number,
        conversationId: number,
        metadata: OpenAIMetadata
    ): Promise<FinishedChatTurn> {
        return this.saveAssistantMessage(
            userId,
            conversationId,
            'No se pudo generar una respuesta.',
            metadata
        )
    }

    private static async saveAssistantMessage(
        userId: number,
        conversationId: number,
        message: string,
        metadata: OpenAIMetadata
    ): Promise<FinishedChatTurn> {
        const transaction = await db.transaction('write')
        try {
            const assistantMessage = (
                await transaction.execute({
                    sql: `
                        INSERT INTO conversation_messages (
                            conversation_id,
                            message,
                            sender,
                            status,
                            openai_response_id,
                            input_tokens,
                            output_tokens,
                            error_code
                        )
                        SELECT ?, ?, 'assistant', ?, ?, ?, ?, ?
                        WHERE EXISTS (
                            SELECT 1
                            FROM conversations
                            WHERE id = ? AND user_id = ?
                        )
                        RETURNING *
                    `,
                    args: [
                        conversationId,
                        message,
                        metadata.status,
                        metadata.responseId ?? null,
                        metadata.inputTokens ?? null,
                        metadata.outputTokens ?? null,
                        metadata.errorCode ?? null,
                        conversationId,
                        userId,
                    ],
                })
            ).rows[0]

            if (!assistantMessage) {
                throw new Error('Conversation not found while saving response')
            }

            const conversation = (
                await transaction.execute({
                    sql: `
                        UPDATE conversations
                        SET
                            last_message_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                        RETURNING *
                    `,
                    args: [conversationId, userId],
                })
            ).rows[0]

            await AiGenerationModel.record(
                userId,
                'chat',
                metadata,
                transaction
            )
            await transaction.commit()
            return { conversation, assistantMessage }
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }
}
