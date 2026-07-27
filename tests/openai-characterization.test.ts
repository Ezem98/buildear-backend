import assert from 'node:assert/strict'
import test from 'node:test'
import type OpenAI from 'openai'
import { Categories } from '../enums/categories.js'
import { ExperienceLevel } from '../enums/experienceLevel.js'
import {
    OpenAIServiceError,
    ResponsesOpenAIService,
} from '../services/openAI.js'

const generatedGuide = {
    titulo: 'Guía simulada',
    explicacion: 'Respuesta local sin acceder a OpenAI',
    pasos: [],
    materiales: [],
    tiempo_insumido: 30,
    costo: 20,
}

test('uses Responses with structured output, store false and simulated telemetry', async () => {
    const calls: Array<{ operation: string; payload: unknown }> = []
    const fakeClient = {
        responses: {
            parse: async (payload: unknown) => {
                calls.push({ operation: 'responses.parse', payload })
                return {
                    id: 'resp_guide_test',
                    model: 'guide-test-model',
                    status: 'completed',
                    output_parsed: generatedGuide,
                    usage: {
                        input_tokens: 120,
                        output_tokens: 80,
                    },
                }
            },
            create: async (payload: unknown) => {
                calls.push({ operation: 'responses.create', payload })
                return {
                    id: 'resp_chat_test',
                    model: 'gpt-4o-mini',
                    status: 'completed',
                    output_text: 'Respuesta simulada',
                    usage: {
                        input_tokens: 10,
                        output_tokens: 5,
                    },
                }
            },
        },
    } as unknown as Pick<OpenAI, 'responses'>
    const service = new ResponsesOpenAIService(fakeClient, {
        guideModel: 'guide-test-model',
        chatModel: 'gpt-4o-mini',
    })

    const guideResult = await service.generateGuide({
        modelCategory: Categories.Wall,
        modelName: 'pared',
        modelSize: { width: 300, height: 240 },
        experienceLevel: ExperienceLevel.BEGINNER,
    })
    assert.deepEqual(guideResult.data, generatedGuide)
    assert.equal(guideResult.metadata.responseId, 'resp_guide_test')
    assert.equal(guideResult.metadata.inputTokens, 120)
    assert.equal(guideResult.metadata.outputTokens, 80)

    const messageResult = await service.respondToMessage('Mensaje de prueba')
    assert.equal(messageResult.data, 'Respuesta simulada')
    assert.equal(messageResult.metadata.responseId, 'resp_chat_test')

    assert.deepEqual(
        calls.map(({ operation }) => operation),
        ['responses.parse', 'responses.create']
    )
    for (const call of calls) {
        assert.equal(
            (call.payload as { store?: boolean }).store,
            false,
            `${call.operation} must keep store=false`
        )
    }
    const guidePayload = calls[0].payload as {
        text?: { format?: unknown }
    }
    assert.ok(guidePayload.text?.format)
})

test('normalizes incomplete Responses without making a real request', async () => {
    const fakeClient = {
        responses: {
            parse: async () => ({
                id: 'resp_incomplete',
                model: 'guide-test-model',
                status: 'incomplete',
                output_parsed: null,
                usage: null,
            }),
        },
    } as unknown as Pick<OpenAI, 'responses'>
    const service = new ResponsesOpenAIService(fakeClient, {
        guideModel: 'guide-test-model',
        chatModel: 'gpt-4o-mini',
    })

    await assert.rejects(
        service.generateGuide({
            modelCategory: Categories.Wall,
            modelName: 'pared',
            modelSize: { width: 300, height: 240 },
            experienceLevel: ExperienceLevel.BEGINNER,
        }),
        (error: unknown) =>
            error instanceof OpenAIServiceError &&
            error.code === 'OPENAI_RESPONSE_INCOMPLETE' &&
            error.metadata.responseId === 'resp_incomplete'
    )
})

test('normalizes Responses refusals without making a real request', async () => {
    const fakeClient = {
        responses: {
            parse: async () => ({
                id: 'resp_refusal',
                model: 'guide-test-model',
                status: 'completed',
                output: [
                    {
                        type: 'message',
                        content: [
                            {
                                type: 'refusal',
                                refusal: 'No puedo ayudar con esa solicitud',
                            },
                        ],
                    },
                ],
                output_parsed: null,
                usage: {
                    input_tokens: 12,
                    output_tokens: 4,
                },
            }),
        },
    } as unknown as Pick<OpenAI, 'responses'>
    const service = new ResponsesOpenAIService(fakeClient, {
        guideModel: 'guide-test-model',
        chatModel: 'gpt-4o-mini',
    })

    await assert.rejects(
        service.generateGuide({
            modelCategory: Categories.Wall,
            modelName: 'pared',
            modelSize: { width: 300, height: 240 },
            experienceLevel: ExperienceLevel.BEGINNER,
        }),
        (error: unknown) =>
            error instanceof OpenAIServiceError &&
            error.code === 'OPENAI_REFUSAL' &&
            error.metadata.responseId === 'resp_refusal' &&
            error.metadata.inputTokens === 12
    )
})
