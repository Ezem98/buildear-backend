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
    pasos: [
        {
            paso: 1,
            titulo: 'Preparar',
            descripcion: 'Prepará el área y verificá que esté despejada.',
        },
        {
            paso: 2,
            titulo: 'Colocar',
            descripcion: 'Colocá el componente y controlá su alineación.',
        },
        {
            paso: 3,
            titulo: 'Verificar',
            descripcion: 'Revisá la terminación antes de dar por finalizado.',
        },
    ],
    materiales: [
        {
            material: 'Componente',
            cantidad: 'Según el modelo',
            finalidad: 'Ejecutar la colocación indicada.',
        },
    ],
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

    const messageResult = await service.respondToMessage('Mensaje de prueba', [
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
    ])
    assert.equal(messageResult.data, 'Respuesta simulada')
    assert.equal(messageResult.metadata.responseId, 'resp_chat_test')

    await service.respondToMessage('Mensaje ya guardado', [
        { role: 'user', content: 'Mensaje ya guardado' },
    ])

    assert.deepEqual(
        calls.map(({ operation }) => operation),
        ['responses.parse', 'responses.create', 'responses.create']
    )
    for (const call of calls) {
        assert.equal(
            (call.payload as { store?: boolean }).store,
            false,
            `${call.operation} must keep store=false`
        )
    }
    const guidePayload = calls[0].payload as {
        instructions?: string
        input?: string
        text?: { format?: unknown }
        tools?: unknown[]
        tool_choice?: string
    }
    assert.ok(guidePayload.text?.format)
    assert.match(guidePayload.instructions ?? '', /No hagas preguntas/)
    assert.match(guidePayload.instructions ?? '', /lista de pasos/)
    assert.match(guidePayload.instructions ?? '', /estimación orientativa/)
    assert.match(guidePayload.instructions ?? '', /Easy Argentina/)
    assert.match(guidePayload.instructions ?? '', /Sodimac Argentina/)
    assert.match(guidePayload.instructions ?? '', /1 USD = 1500 ARS/)
    assert.match(
        guidePayload.instructions ?? '',
        /usá "hueco" o "abertura" en lugar de "vano"/
    )
    assert.doesNotMatch(
        guidePayload.instructions ?? '',
        /verificación del vano/
    )
    assert.doesNotMatch(
        guidePayload.instructions ?? '',
        /Como la entrada no incluye una lista de precios verificable/
    )
    assert.deepEqual(guidePayload.tools, [
        {
            type: 'web_search',
            filters: {
                allowed_domains: ['easy.com.ar', 'sodimac.com.ar'],
            },
            search_context_size: 'low',
            user_location: {
                type: 'approximate',
                country: 'AR',
                region: 'Buenos Aires',
                city: 'Buenos Aires',
                timezone: 'America/Argentina/Buenos_Aires',
            },
        },
    ])
    assert.equal(guidePayload.tool_choice, 'required')
    assert.deepEqual(JSON.parse(guidePayload.input ?? '{}'), {
        tarea: 'construir',
        categoria: 'pared',
        nombre: 'pared',
        dimensiones: {
            ancho_centimetros: 300,
            alto_centimetros: 240,
        },
        experiencia: 'poca experiencia',
        salida_interfaz: {
            formato: 'lista de pasos tipo nota de cuaderno',
            unidad_tiempo: 'minutos',
            moneda_precios_consultados: 'ARS',
            moneda_costo: 'USD',
            tipo_cambio_ars_por_usd: 1500,
            alcance_costo:
                'materiales para una unidad; no incluye mano de obra, herramientas ni alquileres',
            tipo_costo: 'estimación orientativa, no cotización',
            fuentes_precio_permitidas: [
                'https://www.easy.com.ar',
                'https://www.sodimac.com.ar',
            ],
        },
    })
    const chatPayload = calls[1].payload as {
        instructions?: string
        input?: Array<{ role: string; content: string }>
    }
    assert.match(
        chatPayload.instructions ?? '',
        /usá "hueco" o "abertura" en lugar de "vano"/
    )
    assert.deepEqual(chatPayload.input, [
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
        { role: 'user', content: 'Mensaje de prueba' },
    ])
    const deduplicatedChatPayload = calls[2].payload as {
        input?: Array<{ role: string; content: string }>
    }
    assert.deepEqual(deduplicatedChatPayload.input, [
        { role: 'user', content: 'Mensaje ya guardado' },
    ])
})

test('places persisted guide context before chat history without storing it', async () => {
    const calls: unknown[] = []
    const fakeClient = {
        responses: {
            create: async (payload: unknown) => {
                calls.push(payload)
                return {
                    id: 'resp_context_test',
                    model: 'chat-test-model',
                    status: 'completed',
                    output_text: 'Respuesta contextual',
                    usage: { input_tokens: 20, output_tokens: 8 },
                }
            },
        },
    } as unknown as Pick<OpenAI, 'responses'>
    const service = new ResponsesOpenAIService(fakeClient, {
        guideModel: 'guide-test-model',
        chatModel: 'chat-test-model',
    })

    await service.respondToMessage(
        '¿Qué reviso en este paso?',
        [{ role: 'assistant', content: 'Conversación previa' }],
        {
            modelId: 7,
            modelCategory: Categories.Wall,
            modelName: 'Pared de práctica',
            widthCentimeters: 300,
            heightCentimeters: 240,
            experienceLevel: ExperienceLevel.BEGINNER,
            currentStep: 2,
            guide: generatedGuide,
        }
    )

    const payload = calls[0] as {
        store?: boolean
        input?: Array<{ role: string; content: string }>
    }
    assert.equal(payload.store, false)
    assert.equal(payload.input?.[0]?.role, 'developer')
    const applicationContext = JSON.parse(payload.input?.[0]?.content ?? '{}')
    assert.equal(applicationContext.modelo.id, 7)
    assert.equal(applicationContext.modelo.categoria, 'pared')
    assert.equal(applicationContext.paso_actual, 2)
    assert.deepEqual(applicationContext.guia, generatedGuide)
    assert.deepEqual(payload.input?.slice(1), [
        { role: 'assistant', content: 'Conversación previa' },
        { role: 'user', content: '¿Qué reviso en este paso?' },
    ])
})

test('retries an incomplete guide response once', async () => {
    let attempts = 0
    const fakeClient = {
        responses: {
            parse: async () => {
                attempts += 1
                if (attempts === 1) {
                    return {
                        id: 'resp_incomplete_first_attempt',
                        model: 'guide-test-model',
                        status: 'incomplete',
                        output_parsed: null,
                        usage: null,
                    }
                }

                return {
                    id: 'resp_retry_success',
                    model: 'guide-test-model',
                    status: 'completed',
                    output_parsed: generatedGuide,
                    usage: { input_tokens: 100, output_tokens: 60 },
                }
            },
        },
    } as unknown as Pick<OpenAI, 'responses'>
    const service = new ResponsesOpenAIService(fakeClient, {
        guideModel: 'guide-test-model',
        chatModel: 'chat-test-model',
    })

    const result = await service.generateGuide({
        modelCategory: Categories.Floor,
        modelName: 'piso',
        modelSize: { width: 40, height: 40 },
        experienceLevel: ExperienceLevel.BEGINNER,
    })

    assert.equal(attempts, 2)
    assert.deepEqual(result.data, generatedGuide)
    assert.equal(result.metadata.responseId, 'resp_retry_success')
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
