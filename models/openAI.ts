import type { Row } from '@libsql/client'
import {
    CHAT_PROMPT_VERSION,
    createOpenAIProviderFromEnvironment,
    GUIDE_PROMPT_VERSION,
    type OpenAIMetadata,
    type OpenAIProvider,
    OpenAIServiceError,
} from '../services/openAI.js'
import type { IDBResponse } from '../types/dbResponse.js'
import type { IGuide } from '../types/guide.js'
import type { IOpenAI } from '../types/openAI.js'
import type { OpenAIFeature } from './aiGenerations.js'
import {
    type FinishedChatTurn,
    OpenAIWorkflowModel,
} from './openAIWorkflows.js'

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

function failureMetadata(
    feature: OpenAIFeature,
    error: unknown
): OpenAIMetadata {
    return error instanceof OpenAIServiceError
        ? error.metadata
        : fallbackFailure(feature, error)
}

function persistenceFailure(
    metadata: OpenAIMetadata,
    errorCode: string
): OpenAIMetadata {
    return {
        ...metadata,
        status: 'failed',
        errorCode,
    }
}

export interface GeneratedGuideFlow {
    guide: IGuide
    userModel: Row
}

export interface GeneratedChatFlow {
    answer?: string
    conversation: Row
    userMessage: Row
    assistantMessage?: Row
}

function chatFlow(
    startedTurn: {
        conversation: Row
        userMessage: Row
    },
    finishedTurn: FinishedChatTurn
): GeneratedChatFlow {
    return {
        conversation: finishedTurn.conversation,
        userMessage: startedTurn.userMessage,
        assistantMessage: finishedTurn.assistantMessage,
    }
}

export class OpenAIModel {
    static setProviderForTests(testProvider?: OpenAIProvider): void {
        injectedProvider = testProvider
    }

    static async generateStepsWithOpenAI(
        openAIProps: IOpenAI,
        userId: number,
        modelId: number
    ): Promise<IDBResponse<GeneratedGuideFlow>> {
        let result
        try {
            result = await provider().generateGuide(openAIProps)
        } catch (error) {
            await OpenAIWorkflowModel.saveGuideFailure(
                userId,
                modelId,
                failureMetadata('guide', error)
            )
            return {
                successfully: false,
                message: 'Failed to generate steps',
            }
        }

        try {
            const userModel = await OpenAIWorkflowModel.saveGeneratedGuide(
                userId,
                modelId,
                result.data,
                result.metadata
            )
            if (!userModel) {
                return {
                    successfully: false,
                    message: 'Model not found',
                }
            }
            return {
                successfully: true,
                message: 'Steps generated',
                data: {
                    guide: result.data,
                    userModel,
                },
            }
        } catch {
            await OpenAIWorkflowModel.saveGuideFailure(
                userId,
                modelId,
                persistenceFailure(
                    result.metadata,
                    'OPENAI_GUIDE_PERSISTENCE_ERROR'
                )
            )
            return {
                successfully: false,
                message: 'Failed to persist generated steps',
            }
        }
    }

    static async responseMessage(
        message: string,
        userId: number,
        conversationId?: number
    ): Promise<IDBResponse<GeneratedChatFlow>> {
        const startedTurn = await OpenAIWorkflowModel.startChatTurn(
            userId,
            message,
            conversationId
        )
        if (!startedTurn) {
            return {
                successfully: false,
                message: 'Conversation not found',
            }
        }

        let result
        try {
            result = await provider().respondToMessage(
                message,
                startedTurn.context
            )
        } catch (error) {
            const failedTurn = await OpenAIWorkflowModel.failChatTurn(
                userId,
                Number(startedTurn.conversation.id),
                failureMetadata('chat', error)
            )
            return {
                successfully: false,
                message: 'Failed to generate message',
                data: chatFlow(startedTurn, failedTurn),
            }
        }

        try {
            const finishedTurn = await OpenAIWorkflowModel.finishChatTurn(
                userId,
                Number(startedTurn.conversation.id),
                result.data,
                result.metadata
            )
            return {
                successfully: true,
                message: 'Message generated',
                data: {
                    ...chatFlow(startedTurn, finishedTurn),
                    answer: result.data,
                },
            }
        } catch {
            const failedTurn = await OpenAIWorkflowModel.failChatTurn(
                userId,
                Number(startedTurn.conversation.id),
                persistenceFailure(
                    result.metadata,
                    'OPENAI_CHAT_PERSISTENCE_ERROR'
                )
            )
            return {
                successfully: false,
                message: 'Failed to persist generated message',
                data: chatFlow(startedTurn, failedTurn),
            }
        }
    }
}
