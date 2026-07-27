import type { Transaction } from '@libsql/client'
import type { OpenAIMetadata } from '../services/openAI.js'
import { db } from '../utils/consts.js'

export type OpenAIFeature = 'guide' | 'chat'

export class AiGenerationModel {
    static async record(
        userId: number,
        feature: OpenAIFeature,
        metadata: OpenAIMetadata,
        executor: Pick<Transaction, 'execute'> = db
    ): Promise<void> {
        await executor.execute({
            sql: `
                INSERT INTO ai_generations (
                    user_id,
                    feature,
                    provider,
                    model,
                    response_id,
                    prompt_version,
                    status,
                    input_tokens,
                    output_tokens,
                    latency_ms,
                    error_code
                )
                VALUES (?, ?, 'openai', ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                userId,
                feature,
                metadata.model,
                metadata.responseId ?? null,
                metadata.promptVersion,
                metadata.status,
                metadata.inputTokens ?? null,
                metadata.outputTokens ?? null,
                metadata.latencyMs,
                metadata.errorCode ?? null,
            ],
        })
    }
}
