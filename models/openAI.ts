import type { IDBResponse } from '../types/dbResponse.js'
import type { IGuide } from '../types/guide.js'
import type { IOpenAI } from '../types/openAI.js'
import {
    CHAT_PROMPT_VERSION,
    createOpenAIProviderFromEnvironment,
    GUIDE_PROMPT_VERSION,
    type OpenAIMetadata,
    type OpenAIProvider,
    OpenAIServiceError,
} from '../services/openAI.js'
import { AiGenerationModel, type OpenAIFeature } from './aiGenerations.js'

let injectedProvider: OpenAIProvider | undefined
let environmentProvider: OpenAIProvider | undefined

function provider(): OpenAIProvider {
    if (injectedProvider) return injectedProvider
    environmentProvider ??= createOpenAIProviderFromEnvironment()
    return environmentProvider
}

function fallbackFailure(
    feature: OpenAIFeature,
    error: unknown
): OpenAIMetadata {
    return {
        model: 'unknown',
        promptVersion:
            feature === 'guide' ? GUIDE_PROMPT_VERSION : CHAT_PROMPT_VERSION,
        latencyMs: 0,
        status: 'failed',
        errorCode:
            error instanceof OpenAIServiceError
                ? error.code
                : 'OPENAI_CONFIGURATION_ERROR',
    }
}

async function recordFailure(
    userId: number,
    feature: OpenAIFeature,
    error: unknown
): Promise<void> {
    const metadata =
        error instanceof OpenAIServiceError
            ? error.metadata
            : fallbackFailure(feature, error)
    await AiGenerationModel.record(userId, feature, metadata)
}

export class OpenAIModel {
    static setProviderForTests(testProvider?: OpenAIProvider): void {
        injectedProvider = testProvider
    }

    static async generateStepsWithOpenAI(
        openAIProps: IOpenAI,
        userId: number
    ): Promise<IDBResponse<IGuide>> {
        try {
            const result = await provider().generateGuide(openAIProps)
            await AiGenerationModel.record(userId, 'guide', result.metadata)
            return {
                successfully: true,
                message: 'Steps generated',
                data: result.data,
            }
        } catch (error) {
            await recordFailure(userId, 'guide', error)
            return {
                successfully: false,
                message: 'Failed to generate steps',
            }
        }
    }

    static async responseMessage(
        message: string,
        userId: number
    ): Promise<IDBResponse<string>> {
        try {
            const result = await provider().respondToMessage(message)
            await AiGenerationModel.record(userId, 'chat', result.metadata)
            return {
                successfully: true,
                message: 'Message generated',
                data: result.data,
            }
        } catch (error) {
            await recordFailure(userId, 'chat', error)
            return {
                successfully: false,
                message: 'Failed to generate message',
            }
        }
    }
}
