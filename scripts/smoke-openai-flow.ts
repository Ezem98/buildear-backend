import { randomUUID } from 'node:crypto'
import { app } from '../app.js'
import { db } from '../utils/consts.js'

interface ApiResponse<T> {
    status: number
    body: T
}

async function api<T>(
    baseUrl: string,
    route: string,
    options: {
        method?: string
        token?: string
        body?: unknown
    } = {}
): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {}
    if (options.token) headers.authorization = `Bearer ${options.token}`
    if (options.body !== undefined) headers['content-type'] = 'application/json'

    const response = await fetch(`${baseUrl}${route}`, {
        method: options.method ?? 'GET',
        headers,
        body:
            options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
    })
    const text = await response.text()
    const body = (text ? JSON.parse(text) : undefined) as T
    if (!response.ok) {
        throw new Error(
            `Smoke ${options.method ?? 'GET'} ${route} failed with ${response.status}: ${text}`
        )
    }
    return { status: response.status, body }
}

const databaseUrl = process.env.TURSO_DATABASE_URL ?? ''
if (!databaseUrl.toLowerCase().includes('staging')) {
    throw new Error(
        'El smoke real sólo puede ejecutarse contra una URL que contenga "staging"'
    )
}

const server = app.listen(0, '127.0.0.1')

try {
    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
        throw new Error('No se pudo resolver el puerto del smoke')
    }
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`
    const suffix = `${Date.now()}${randomUUID().slice(0, 8)}`
    const username = `codexflow${suffix}`
    const password = `Codex-${randomUUID()}`

    const registration = await api<{
        data: { id: number }
    }>(baseUrl, '/users', {
        method: 'POST',
        body: {
            name: 'Codex',
            surname: 'FunctionalSmoke',
            username,
            email: `${username}@example.test`,
            password,
            experience_level: 1,
            completed_profile: 1,
        },
    })
    const userId = Number(registration.body.data.id)

    const login = await api<{
        data: { access_token: string }
    }>(baseUrl, '/auth/login', {
        method: 'POST',
        body: { username, password },
    })
    const token = login.body.data.access_token

    const models = await api<{
        data: Array<{
            id: number
            name: string
            category_id: number
            width: number
            height: number
        }>
    }>(baseUrl, '/models')
    const model = models.body.data.find(
        (candidate) =>
            Number(candidate.width) > 0 && Number(candidate.height) > 0
    )
    if (!model) {
        throw new Error('Staging no contiene un modelo con dimensiones válidas')
    }

    const guide = await api<{
        successfully: boolean
        user_model: { id: number }
    }>(baseUrl, '/openai', {
        method: 'POST',
        token,
        body: {
            model_id: Number(model.id),
            modelCategory: Number(model.category_id),
            modelName: String(model.name),
            modelSize: {
                width: Number(model.width),
                height: Number(model.height),
            },
            experienceLevel: 1,
        },
    })

    const chat = await api<{
        successfully: boolean
        conversation_id: number
    }>(baseUrl, '/openai/message', {
        method: 'POST',
        token,
        body: {
            message:
                '¿Qué verificaciones de seguridad debo hacer antes de comenzar?',
        },
    })
    const conversationId = Number(chat.body.conversation_id)

    const persistedGuide = await api<{
        data: {
            id: number
            generation_status: string
            openai_response_id?: string
            openai_model?: string
            current_step: number
            completed: number
        }
    }>(baseUrl, `/userModels/${userId}/${Number(model.id)}`, { token })
    const messages = await api<{
        data: Array<{
            sender: string
            status: string
            openai_response_id?: string
            input_tokens?: number
            output_tokens?: number
        }>
    }>(baseUrl, `/conversationMessage/conversation/${conversationId}`, {
        token,
    })
    const conversations = await api<{
        data: Array<{ id: number }>
    }>(baseUrl, `/conversation/user/${userId}`, { token })

    await api(baseUrl, '/auth/logout', { method: 'POST', token })

    const assistantMessage = messages.body.data.at(-1)
    console.log(
        JSON.stringify(
            {
                user_id: userId,
                username,
                model_id: Number(model.id),
                guide_http: guide.body.successfully,
                user_model_id: Number(persistedGuide.body.data.id),
                guide_status: persistedGuide.body.data.generation_status,
                guide_response_id_present: Boolean(
                    persistedGuide.body.data.openai_response_id
                ),
                guide_model: persistedGuide.body.data.openai_model,
                current_step: Number(persistedGuide.body.data.current_step),
                completed: Number(persistedGuide.body.data.completed),
                chat_http: chat.body.successfully,
                conversation_id: conversationId,
                conversation_visible: conversations.body.data.some(
                    (conversation) => Number(conversation.id) === conversationId
                ),
                message_count: messages.body.data.length,
                message_senders: messages.body.data.map(
                    (message) => message.sender
                ),
                assistant_status: assistantMessage?.status,
                assistant_response_id_present: Boolean(
                    assistantMessage?.openai_response_id
                ),
                assistant_input_tokens: assistantMessage?.input_tokens,
                assistant_output_tokens: assistantMessage?.output_tokens,
                session_revoked: true,
            },
            null,
            2
        )
    )
} finally {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
    })
    db.close()
}
