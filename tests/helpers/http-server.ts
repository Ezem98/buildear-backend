import { app } from '../../app.js'
import { CloudinaryModel } from '../../models/cloudinary.js'
import { OpenAIModel } from '../../models/openAI.js'
import {
    CHAT_PROMPT_VERSION,
    GUIDE_PROMPT_VERSION,
    OpenAIServiceError,
    type OpenAIProvider,
} from '../../services/openAI.js'
import { db } from '../../utils/consts.js'

const fakeProvider: OpenAIProvider = {
    async generateGuide(input) {
        if (input.experienceLevel === 3) {
            throw new OpenAIServiceError('OPENAI_PROVIDER_ERROR', {
                model: 'guide-test-model',
                promptVersion: GUIDE_PROMPT_VERSION,
                latencyMs: 7,
                status: 'failed',
                errorCode: 'OPENAI_PROVIDER_ERROR',
            })
        }
        return {
            data: {
                titulo: 'Guía HTTP simulada',
                explicacion: 'No utiliza red',
                pasos: [
                    {
                        paso: 1,
                        titulo: 'Preparar',
                        descripcion: 'Prepará el área de trabajo.',
                    },
                    {
                        paso: 2,
                        titulo: 'Colocar',
                        descripcion: 'Colocá el componente.',
                    },
                    {
                        paso: 3,
                        titulo: 'Verificar',
                        descripcion: 'Verificá la terminación.',
                    },
                ],
                materiales: [
                    {
                        material: 'Componente',
                        cantidad: 'Según el modelo',
                        finalidad: 'Completar la práctica.',
                    },
                ],
                tiempo_insumido: 30,
                costo: 20,
            },
            metadata: {
                responseId: 'resp_http_guide',
                model: 'guide-test-model',
                promptVersion: GUIDE_PROMPT_VERSION,
                inputTokens: 100,
                outputTokens: 50,
                latencyMs: 12,
                status: 'completed',
            },
        }
    },
    async respondToMessage(message, context = [], constructionContext) {
        if (message === 'simulate-error') {
            throw new OpenAIServiceError('OPENAI_PROVIDER_ERROR', {
                model: 'gpt-4o-mini',
                promptVersion: CHAT_PROMPT_VERSION,
                latencyMs: 8,
                status: 'failed',
                errorCode: 'OPENAI_PROVIDER_ERROR',
            })
        }
        return {
            data:
                message === 'inspect-context'
                    ? JSON.stringify(context)
                    : message === 'inspect-guide-context'
                      ? JSON.stringify(constructionContext)
                      : 'Respuesta HTTP simulada',
            metadata: {
                responseId: 'resp_http_chat',
                model: 'gpt-4o-mini',
                promptVersion: CHAT_PROMPT_VERSION,
                inputTokens: 20,
                outputTokens: 10,
                latencyMs: 9,
                status: 'completed',
            },
        }
    },
}

OpenAIModel.setProviderForTests(fakeProvider)
CloudinaryModel.setProviderForTests({
    async upload(filePath, options) {
        const format =
            options.resource_type === 'raw'
                ? filePath.toLowerCase().endsWith('.gltf')
                    ? 'gltf'
                    : 'glb'
                : 'png'
        return {
            secure_url: `https://assets.example.test/${options.folder}/${options.public_id}.${format}`,
            public_id: `${options.folder}/${options.public_id}`,
            format,
            bytes: 128,
            version: 1,
            resource_type: options.resource_type,
        }
    },
    async destroy() {
        return { result: 'ok' }
    },
})

const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
        throw new Error('No se pudo resolver el puerto HTTP de prueba')
    }
    console.log(JSON.stringify({ port: address.port }))
})

function shutdown(): void {
    server.close(() => {
        db.close()
        process.exitCode = 0
    })
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
