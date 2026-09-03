import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import type { Client } from '@libsql/client'
import { createDatabaseClient } from '../database/client.js'
import { runMigrations } from '../database/migrations.js'
import { findInvalidModelData } from '../services/modelDataAudit.js'

let client: Client
let temporaryDirectory: string

before(async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'buildear-audit-'))
    client = await createDatabaseClient({
        url: `file:${path.join(temporaryDirectory, 'audit.db')}`,
    })
    await runMigrations(client, path.resolve('migrations'))
})

after(async () => {
    client.close()
    await rm(temporaryDirectory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
    })
})

test('reports models that cannot generate a guide', async () => {
    await client.execute({
        sql: `
            INSERT INTO models (
                name, model_data, model_image, difficulty_rating,
                category_id, height, width
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            'Modelo inválido',
            'https://example.test/model.glb',
            'https://example.test/model.png',
            1,
            1,
            0,
            100,
        ],
    })

    assert.deepEqual(await findInvalidModelData(client), [
        {
            id: 1,
            name: 'Modelo inválido',
            height: 0,
            width: 100,
            categoryId: 1,
        },
    ])
})

test('accepts positive dimensions and a supported category', async () => {
    await client.execute('DELETE FROM models')
    await client.execute({
        sql: `
            INSERT INTO models (
                name, model_data, model_image, difficulty_rating,
                category_id, height, width
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            'Modelo válido',
            'https://example.test/model.glb',
            'https://example.test/model.png',
            1,
            3,
            100,
            200,
        ],
    })

    assert.deepEqual(await findInvalidModelData(client), [])
})
