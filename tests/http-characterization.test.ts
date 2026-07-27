import assert from 'node:assert/strict'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = fileURLToPath(
    new URL('../migrations', import.meta.url)
)
const migrationHelper = fileURLToPath(
    new URL('./helpers/migration-process.ts', import.meta.url)
)
const serverHelper = fileURLToPath(
    new URL('./helpers/http-server.ts', import.meta.url)
)

function databaseUrl(directory: string): string {
    return `file:${path.join(directory, 'http.db').replaceAll('\\', '/')}`
}

function runDatabaseHelper<T>(
    command: string,
    url: string,
    argument?: string
): T {
    const result = spawnSync(
        process.execPath,
        [
            '--import',
            'tsx',
            migrationHelper,
            command,
            url,
            migrationsDirectory,
            ...(argument ? [argument] : []),
        ],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
        }
    )

    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout.trim()) as T
}

async function startServer(url: string): Promise<{
    baseUrl: string
    child: ChildProcess
}> {
    const child = spawn(process.execPath, ['--import', 'tsx', serverHelper], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            TURSO_DATABASE_URL: url,
            TURSO_AUTH_TOKEN: '',
            AUTH_SESSION_TTL_SECONDS: '3600',
            AUTH_LOGIN_LIMIT: '10',
            CORS_ALLOWED_ORIGINS: 'http://allowed.example.test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stderr: string[] = []
    child.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
    const lines = createInterface({ input: child.stdout! })

    const port = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(
                new Error(
                    `El servidor HTTP de prueba no inició: ${stderr.join('')}`
                )
            )
        }, 10000)

        lines.once('line', (line) => {
            clearTimeout(timeout)
            try {
                resolve(Number(JSON.parse(line).port))
            } catch (error) {
                reject(error)
            }
        })
        child.once('exit', (code) => {
            clearTimeout(timeout)
            reject(
                new Error(
                    `El servidor HTTP terminó con ${code}: ${stderr.join('')}`
                )
            )
        })
    })

    lines.close()
    return { baseUrl: `http://127.0.0.1:${port}`, child }
}

async function stopServer(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null) return
    child.kill('SIGTERM')
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000)
        child.once('exit', () => {
            clearTimeout(timeout)
            resolve()
        })
    })
}

interface ApiResponse {
    status: number
    body?: any
    headers: Headers
}

async function api(
    baseUrl: string,
    route: string,
    options: {
        method?: string
        token?: string
        body?: unknown
        origin?: string
    } = {}
): Promise<ApiResponse> {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.token) headers.authorization = `Bearer ${options.token}`
    if (options.origin) headers.origin = options.origin

    const response = await fetch(`${baseUrl}${route}`, {
        method: options.method ?? 'GET',
        headers,
        body:
            options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
    })
    const text = await response.text()
    let body: unknown
    if (text) {
        try {
            body = JSON.parse(text)
        } catch {
            body = text
        }
    }

    return {
        status: response.status,
        body,
        headers: response.headers,
    }
}

async function multipartApi(
    baseUrl: string,
    route: string,
    token: string,
    fields: Record<string, string>,
    files: Array<{
        field: string
        name: string
        type: string
        content: Uint8Array
    }>
): Promise<ApiResponse> {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.set(key, value)
    for (const file of files) {
        const content = Uint8Array.from(file.content).buffer
        form.set(
            file.field,
            new Blob([content], { type: file.type }),
            file.name
        )
    }

    const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
    })
    const text = await response.text()
    return {
        status: response.status,
        body: text ? JSON.parse(text) : undefined,
        headers: response.headers,
    }
}

function assertPublicUser(user: Record<string, unknown>): void {
    assert.equal('password' in user, false)
    assert.equal('password_salt' in user, false)
}

const guide = {
    titulo: 'Guía de prueba',
    explicacion: 'Explicación de caracterización',
    pasos: [
        {
            paso: 1,
            titulo: 'Preparar',
            descripcion: 'Preparar la superficie.',
        },
    ],
    materiales: [
        {
            material: 'Cemento',
            cantidad: '1 bolsa',
            finalidad: 'Unir materiales',
        },
    ],
    tiempo_insumido: 60,
    costo: 100,
}

test('protects users and owned resources without leaking credentials', async () => {
    const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'buildear-http-')
    )
    const url = databaseUrl(temporaryDirectory)
    runDatabaseHelper('apply', url)
    const seededModel = runDatabaseHelper<{ id: number }>('seed-model', url)
    const legacyUser = runDatabaseHelper<{
        id: number
        username: string
        role: string
        algorithm: string
    }>('seed-legacy-user', url)
    assert.equal(legacyUser.role, 'user')
    assert.equal(legacyUser.algorithm, 'pbkdf2-sha512')
    const server = await startServer(url)

    try {
        const allowedCors = await api(server.baseUrl, '/', {
            origin: 'http://allowed.example.test',
        })
        assert.equal(allowedCors.status, 200)
        assert.equal(
            allowedCors.headers.get('access-control-allow-origin'),
            'http://allowed.example.test'
        )
        assert.equal(
            allowedCors.headers.get('x-content-type-options'),
            'nosniff'
        )
        assert.equal(allowedCors.headers.get('x-frame-options'), 'DENY')
        assert.match(
            allowedCors.headers.get('content-security-policy') ?? '',
            /default-src 'none'/
        )

        const liveHealth = await api(server.baseUrl, '/health/live')
        assert.equal(liveHealth.status, 200)
        assert.equal(liveHealth.body.status, 'ok')

        const readyHealth = await api(server.baseUrl, '/health/ready')
        assert.equal(readyHealth.status, 200)
        assert.equal(readyHealth.body.dependencies.database, 'ready')

        const deniedCors = await api(server.baseUrl, '/', {
            origin: 'http://denied.example.test',
        })
        assert.equal(deniedCors.status, 403)
        assert.equal(deniedCors.body.error.code, 'CORS_ORIGIN_DENIED')

        const unauthenticated = await api(server.baseUrl, '/users')
        assert.equal(unauthenticated.status, 401)
        assert.equal(unauthenticated.body.error.code, 'AUTH_REQUIRED')
        assert.ok(unauthenticated.body.error.requestId)

        const aliceRegistration = await api(server.baseUrl, '/users', {
            method: 'POST',
            body: {
                name: 'Alice',
                surname: 'Tester',
                username: 'alice01',
                email: 'alice@example.test',
                password: 'initial-password',
                experience_level: 1,
                completed_profile: 1,
            },
        })
        assert.equal(aliceRegistration.status, 201)
        assertPublicUser(aliceRegistration.body.data)
        assert.equal(aliceRegistration.body.data.role, 'user')
        const aliceId = Number(aliceRegistration.body.data.id)

        const bobRegistration = await api(server.baseUrl, '/users', {
            method: 'POST',
            body: {
                name: 'Bob',
                surname: 'Tester',
                username: 'bob0001',
                email: 'bob@example.test',
                password: 'bob-password',
                experience_level: 2,
                completed_profile: 1,
            },
        })
        assert.equal(bobRegistration.status, 201)
        assertPublicUser(bobRegistration.body.data)
        const bobId = Number(bobRegistration.body.data.id)

        const promotion = runDatabaseHelper<{ updated: number }>(
            'promote-user',
            url,
            'alice01'
        )
        assert.equal(promotion.updated, 1)

        const invalidLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: 'alice01',
                password: 'wrong-password',
            },
        })
        assert.equal(invalidLogin.status, 401)

        const aliceLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: 'alice01',
                password: 'initial-password',
            },
        })
        assert.equal(aliceLogin.status, 200)
        assertPublicUser(aliceLogin.body.data.user)
        assert.equal(aliceLogin.body.data.user.role, 'admin')
        const aliceToken = String(aliceLogin.body.data.access_token)

        const bobLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: 'bob0001',
                password: 'bob-password',
            },
        })
        assert.equal(bobLogin.status, 200)
        assert.equal(bobLogin.body.data.user.role, 'user')
        const bobToken = String(bobLogin.body.data.access_token)

        const legacyLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: legacyUser.username,
                password: 'legacy-password',
            },
        })
        assert.equal(legacyLogin.status, 200)

        const rehashedLegacy = runDatabaseHelper<{
            role: string
            algorithm: string
            params: string
        }>('inspect-user', url, legacyUser.username)
        assert.equal(rehashedLegacy.algorithm, 'scrypt')
        assert.equal(JSON.parse(rehashedLegacy.params).cost, 2 ** 15)

        const ownUsers = await api(server.baseUrl, '/users', {
            token: aliceToken,
        })
        assert.equal(ownUsers.status, 200)
        assert.equal(ownUsers.body.data.length, 1)
        assert.equal(ownUsers.body.data[0].id, aliceId)
        assertPublicUser(ownUsers.body.data[0])

        const otherUser = await api(server.baseUrl, '/users/alice01', {
            token: bobToken,
        })
        assert.equal(otherUser.status, 403)

        const passwordInsidePatch = await api(
            server.baseUrl,
            '/users/alice01',
            {
                method: 'PATCH',
                token: aliceToken,
                body: {
                    password: 'initial-password',
                    newPassword: 'should-not-work-here',
                },
            }
        )
        assert.equal(passwordInsidePatch.status, 400)

        const publicModel = await api(
            server.baseUrl,
            `/models/${seededModel.id}`
        )
        assert.equal(publicModel.status, 200)
        assert.equal(publicModel.headers.get('deprecation'), 'true')

        const versionedPublicModel = await api(
            server.baseUrl,
            `/api/v1/models/${seededModel.id}`
        )
        assert.equal(versionedPublicModel.status, 200)
        assert.equal(versionedPublicModel.headers.get('deprecation'), null)

        const unauthorizedModelUpdate = await api(
            server.baseUrl,
            `/models/${seededModel.id}`,
            {
                method: 'PATCH',
                token: bobToken,
                body: { name: 'No autorizado' },
            }
        )
        assert.equal(unauthorizedModelUpdate.status, 403)
        assert.equal(unauthorizedModelUpdate.body.error.code, 'ADMIN_REQUIRED')

        const modelUpdate = await api(
            server.baseUrl,
            `/models/${seededModel.id}`,
            {
                method: 'PATCH',
                token: aliceToken,
                body: {
                    name: 'Modelo actualizado',
                    description:
                        'Descripción actualizada y suficientemente larga',
                    difficulty_rating: 4,
                    category_id: 2,
                    width: 350,
                    height: 250,
                    position: 'vertical',
                },
            }
        )
        assert.equal(modelUpdate.status, 200)
        assert.equal(modelUpdate.body.data.name, 'Modelo actualizado')
        assert.equal(modelUpdate.body.data.category_id, 2)
        assert.equal(modelUpdate.body.data.width, 350)
        assert.equal(modelUpdate.body.data.position, 'vertical')
        assert.equal(
            modelUpdate.body.data.model_data,
            'https://example.test/model.glb'
        )

        const glb = new Uint8Array(12)
        glb.set(new TextEncoder().encode('glTF'), 0)
        new DataView(glb.buffer).setUint32(4, 2, true)
        new DataView(glb.buffer).setUint32(8, glb.byteLength, true)
        const png = Uint8Array.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ])

        const createdModel = await multipartApi(
            server.baseUrl,
            '/models',
            aliceToken,
            {
                name: 'Modelo seguro',
                description: 'Modelo subido con contenido validado',
                difficulty_rating: '3',
                category_id: '3',
                width: '300',
                height: '240',
                position: 'vertical',
            },
            [
                {
                    field: 'modelData',
                    name: 'modelo.glb',
                    type: 'model/gltf-binary',
                    content: glb,
                },
                {
                    field: 'modelImage',
                    name: 'preview.png',
                    type: 'image/png',
                    content: png,
                },
            ]
        )
        assert.equal(createdModel.status, 201)
        assert.match(
            createdModel.body.data.model_data,
            /^https:\/\/assets\.example\.test\/modelsData\//
        )
        assert.match(
            createdModel.body.data.model_image,
            /^https:\/\/assets\.example\.test\/modelsImages\//
        )
        assert.equal(createdModel.body.data.model_format, 'glb')
        assert.equal(createdModel.body.data.model_size_bytes, glb.byteLength)
        assert.match(createdModel.body.data.model_checksum, /^[a-f0-9]{64}$/)
        assert.ok(createdModel.body.data.model_public_id)
        assert.ok(createdModel.body.data.image_public_id)

        const invalidModelUpload = await multipartApi(
            server.baseUrl,
            '/models',
            aliceToken,
            {
                name: 'Modelo inválido',
                description: 'El contenido no coincide con la extensión',
                difficulty_rating: '3',
                category_id: '3',
                width: '300',
                height: '240',
                position: 'vertical',
            },
            [
                {
                    field: 'modelData',
                    name: 'falso.glb',
                    type: 'model/gltf-binary',
                    content: new TextEncoder().encode('contenido inválido'),
                },
                {
                    field: 'modelImage',
                    name: 'preview.png',
                    type: 'image/png',
                    content: png,
                },
            ]
        )
        assert.equal(invalidModelUpload.status, 415)
        assert.equal(
            invalidModelUpload.body.error.code,
            'MODEL_CONTENT_INVALID'
        )

        const invalidOpenAIMessage = await api(
            server.baseUrl,
            '/openAI/message',
            {
                method: 'POST',
                token: aliceToken,
                body: { message: '' },
            }
        )
        assert.equal(invalidOpenAIMessage.status, 400)
        assert.equal(invalidOpenAIMessage.body.error.code, 'VALIDATION_ERROR')

        const generatedGuideResponse = await api(server.baseUrl, '/openAI', {
            method: 'POST',
            token: aliceToken,
            body: {
                modelCategory: 3,
                modelName: 'pared',
                modelSize: { width: 300, height: 240 },
                experienceLevel: 1,
            },
        })
        assert.equal(generatedGuideResponse.status, 200)
        assert.equal(
            generatedGuideResponse.body.data.titulo,
            'Guía HTTP simulada'
        )

        const chatResponse = await api(server.baseUrl, '/openAI/message', {
            method: 'POST',
            token: aliceToken,
            body: { message: '¿Cómo preparo la superficie?' },
        })
        assert.equal(chatResponse.status, 200)
        assert.equal(chatResponse.body.data, 'Respuesta HTTP simulada')

        const failedChatResponse = await api(
            server.baseUrl,
            '/openAI/message',
            {
                method: 'POST',
                token: aliceToken,
                body: { message: 'simulate-error' },
            }
        )
        assert.equal(failedChatResponse.status, 502)
        assert.equal(
            failedChatResponse.body.error.code,
            'OPENAI_MESSAGE_FAILED'
        )

        const generations = runDatabaseHelper<{
            records: Array<Record<string, unknown>>
        }>('inspect-ai-generations', url)
        assert.deepEqual(
            generations.records.map((record) => record.status),
            ['completed', 'completed', 'failed']
        )
        assert.deepEqual(
            generations.records.map((record) => record.response_id),
            ['resp_http_guide', 'resp_http_chat', null]
        )
        assert.deepEqual(
            generations.records.map((record) => record.prompt_version),
            [
                'guide-responses-v1',
                'chat-responses-v2-context-window',
                'chat-responses-v2-context-window',
            ]
        )
        assert.equal(generations.records[0].input_tokens, 100)
        assert.equal(generations.records[1].output_tokens, 10)
        assert.equal(generations.records[2].error_code, 'OPENAI_PROVIDER_ERROR')

        const spoofedFavorite = await api(server.baseUrl, '/favorites', {
            method: 'POST',
            token: aliceToken,
            body: { user_id: bobId, model_id: seededModel.id },
        })
        assert.equal(spoofedFavorite.status, 403)

        const favorite = await api(server.baseUrl, '/favorites', {
            method: 'POST',
            token: aliceToken,
            body: { user_id: aliceId, model_id: seededModel.id },
        })
        assert.equal(favorite.status, 201)

        const favoriteStatus = await api(
            server.baseUrl,
            `/favorites/${aliceId}/${seededModel.id}`,
            { token: aliceToken }
        )
        assert.equal(favoriteStatus.status, 200)
        assert.equal(favoriteStatus.body.data, true)

        const foreignFavorite = await api(
            server.baseUrl,
            `/favorites/${aliceId}/${seededModel.id}`,
            { token: bobToken }
        )
        assert.equal(foreignFavorite.status, 403)

        const progress = await api(server.baseUrl, '/userModels', {
            method: 'POST',
            token: aliceToken,
            body: {
                user_id: aliceId,
                model_id: seededModel.id,
                completed: 0,
                current_step: 1,
                guideObject: guide,
            },
        })
        assert.equal(progress.status, 201)
        const progressId = Number(progress.body.data.id)

        const foreignProgress = await api(
            server.baseUrl,
            `/userModels/${aliceId}/${seededModel.id}`,
            { token: bobToken }
        )
        assert.equal(foreignProgress.status, 403)

        const progressUpdate = await api(
            server.baseUrl,
            `/userModels/${progressId}`,
            {
                method: 'PATCH',
                token: aliceToken,
                body: { completed: 1, current_step: 2 },
            }
        )
        assert.equal(progressUpdate.status, 200)
        assert.equal(progressUpdate.body.data.completed, 1)
        assert.equal(progressUpdate.body.data.current_step, 2)

        const spoofedConversation = await api(server.baseUrl, '/conversation', {
            method: 'POST',
            token: aliceToken,
            body: { user_id: bobId },
        })
        assert.equal(spoofedConversation.status, 403)

        const conversation = await api(server.baseUrl, '/conversation', {
            method: 'POST',
            token: aliceToken,
            body: { user_id: aliceId },
        })
        assert.equal(conversation.status, 201)
        const conversationId = Number(conversation.body.data.id)

        const message = await api(server.baseUrl, '/conversationMessage', {
            method: 'POST',
            token: aliceToken,
            body: {
                conversation_id: conversationId,
                message: 'Hola',
                sender: 'user',
            },
        })
        assert.equal(message.status, 201)
        const messageId = Number(message.body.data.id)

        const assistantMessage = await api(
            server.baseUrl,
            '/conversationMessage',
            {
                method: 'POST',
                token: aliceToken,
                body: {
                    conversation_id: conversationId,
                    message: 'Respuesta previa',
                    sender: 'assistant',
                },
            }
        )
        assert.equal(assistantMessage.status, 201)

        const contextualChat = await api(server.baseUrl, '/openAI/message', {
            method: 'POST',
            token: aliceToken,
            body: {
                conversation_id: conversationId,
                message: 'inspect-context',
            },
        })
        assert.equal(contextualChat.status, 200)
        assert.deepEqual(JSON.parse(contextualChat.body.data), [
            { role: 'user', content: 'Hola' },
            { role: 'assistant', content: 'Respuesta previa' },
        ])

        const foreignContext = await api(server.baseUrl, '/openAI/message', {
            method: 'POST',
            token: bobToken,
            body: {
                conversation_id: conversationId,
                message: 'No debe acceder',
            },
        })
        assert.equal(foreignContext.status, 404)
        assert.equal(foreignContext.body.error.code, 'CONVERSATION_NOT_FOUND')

        const bulkMessages = await api(
            server.baseUrl,
            '/conversationMessage/all',
            {
                method: 'POST',
                token: aliceToken,
                body: {
                    messages: Array.from({ length: 13 }, (_, index) => ({
                        conversation_id: conversationId,
                        message: `context-${index}-${'x'.repeat(1000)}`,
                        sender: index % 2 === 0 ? 'user' : 'assistant',
                    })),
                },
            }
        )
        assert.equal(bulkMessages.status, 201)

        const boundedContextChat = await api(
            server.baseUrl,
            '/openAI/message',
            {
                method: 'POST',
                token: aliceToken,
                body: {
                    conversation_id: conversationId,
                    message: 'inspect-context',
                },
            }
        )
        assert.equal(boundedContextChat.status, 200)
        const boundedContext = JSON.parse(
            boundedContextChat.body.data
        ) as Array<{
            content: string
        }>
        assert.ok(boundedContext.length <= 12)
        assert.ok(
            boundedContext.reduce(
                (total, item) => total + item.content.length,
                0
            ) <= 12_000
        )

        const foreignMessage = await api(
            server.baseUrl,
            `/conversationMessage/${messageId}`,
            { token: bobToken }
        )
        assert.equal(foreignMessage.status, 404)

        const messageList = await api(
            server.baseUrl,
            `/conversationMessage/conversation/${conversationId}`,
            { token: aliceToken }
        )
        assert.equal(messageList.status, 200)
        assert.equal(messageList.body.data.length, 15)

        const deleteMessage = await api(
            server.baseUrl,
            `/conversationMessage/${messageId}`,
            { method: 'DELETE', token: aliceToken }
        )
        assert.equal(deleteMessage.status, 204)

        const conversationStillExists = await api(
            server.baseUrl,
            `/conversation/${conversationId}`,
            { token: aliceToken }
        )
        assert.equal(conversationStillExists.status, 200)

        const wrongCurrentPassword = await api(
            server.baseUrl,
            '/users/me/password',
            {
                method: 'POST',
                token: aliceToken,
                body: {
                    password: 'wrong-password',
                    newPassword: 'updated-password',
                },
            }
        )
        assert.equal(wrongCurrentPassword.status, 401)

        const passwordChange = await api(server.baseUrl, '/users/me/password', {
            method: 'POST',
            token: aliceToken,
            body: {
                password: 'initial-password',
                newPassword: 'updated-password',
            },
        })
        assert.equal(passwordChange.status, 204)

        const revokedAfterPasswordChange = await api(
            server.baseUrl,
            '/users/me',
            { token: aliceToken }
        )
        assert.equal(revokedAfterPasswordChange.status, 401)

        const oldPasswordLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: 'alice01',
                password: 'initial-password',
            },
        })
        assert.equal(oldPasswordLogin.status, 401)

        const newPasswordLogin = await api(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: {
                username: 'alice01',
                password: 'updated-password',
            },
        })
        assert.equal(newPasswordLogin.status, 200)
        const newToken = String(newPasswordLogin.body.data.access_token)

        const logout = await api(server.baseUrl, '/auth/logout', {
            method: 'POST',
            token: newToken,
        })
        assert.equal(logout.status, 204)

        const revokedAfterLogout = await api(server.baseUrl, '/users/me', {
            token: newToken,
        })
        assert.equal(revokedAfterLogout.status, 401)

        let rateLimited: ApiResponse | undefined
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const response = await api(server.baseUrl, '/auth/login', {
                method: 'POST',
                body: {
                    username: 'nobody',
                    password: 'wrong-password',
                },
            })
            if (response.status === 429) {
                rateLimited = response
                break
            }
        }
        assert.equal(rateLimited?.status, 429)
        assert.equal(rateLimited?.body.error.code, 'LOGIN_RATE_LIMITED')

        const expiration = runDatabaseHelper<{ expired: number }>(
            'expire-sessions',
            url
        )
        assert.ok(expiration.expired >= 1)

        const expiredSession = await api(server.baseUrl, '/users/me', {
            token: bobToken,
        })
        assert.equal(expiredSession.status, 401)
        assert.equal(expiredSession.body.error.code, 'INVALID_SESSION')
    } finally {
        await stopServer(server.child)
        await rm(temporaryDirectory, { recursive: true, force: true })
    }
})
