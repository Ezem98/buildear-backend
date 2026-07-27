import assert from 'node:assert/strict'
import { appendFile, cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = fileURLToPath(
    new URL('../migrations', import.meta.url)
)
const helperPath = fileURLToPath(
    new URL('./helpers/migration-process.ts', import.meta.url)
)

interface ProcessResult<T> {
    status: number | null
    stdout: string
    stderr: string
    data?: T
}

function localDatabaseUrl(directory: string, name: string): string {
    const databasePath = path.join(directory, name).replaceAll('\\', '/')
    return `file:${databasePath}`
}

function runMigrationProcess<T>(
    command: string,
    databaseUrl: string,
    directory = migrationsDirectory
): ProcessResult<T> {
    const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', helperPath, command, databaseUrl, directory],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: {
                ...process.env,
                OPENAI_API_KEY: '',
                TURSO_AUTH_TOKEN: '',
            },
        }
    )
    const stdout = result.stdout.trim()

    return {
        status: result.status,
        stdout,
        stderr: result.stderr.trim(),
        data: stdout ? (JSON.parse(stdout) as T) : undefined,
    }
}

test('migrates an empty local database and remains idempotent', async () => {
    const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'buildear-migrations-')
    )
    const databaseUrl = localDatabaseUrl(temporaryDirectory, 'empty.db')

    try {
        const firstRun = runMigrationProcess<{
            applied: string[]
            tables: string[]
            indexCount: number
            categories: string[]
            foreignKeys: number
            orphanRejected: boolean
            metadata: Record<string, string[]>
        }>('apply', databaseUrl)

        assert.equal(firstRun.status, 0, firstRun.stderr)
        assert.deepEqual(firstRun.data?.applied, [
            '0001',
            '0002',
            '0003',
            '0004',
        ])
        assert.deepEqual(firstRun.data?.tables, [
            'ai_generations',
            'auth_sessions',
            'categories',
            'conversation_messages',
            'conversations',
            'favorites',
            'models',
            'schema_migrations',
            'user_models',
            'users',
        ])
        assert.equal(firstRun.data?.indexCount, 10)
        assert.deepEqual(firstRun.data?.categories, [
            'roof',
            'floor',
            'wall',
            'opening',
            'foundation',
        ])
        assert.equal(firstRun.data?.foreignKeys, 1)
        assert.equal(firstRun.data?.orphanRejected, true)

        const expectedMetadataColumns: Record<string, string[]> = {
            users: ['role', 'password_algorithm', 'password_params'],
            models: [
                'model_public_id',
                'image_public_id',
                'model_format',
                'model_size_bytes',
            ],
            user_models: [
                'openai_response_id',
                'openai_model',
                'prompt_version',
                'generated_at',
            ],
            conversations: ['title', 'summary'],
            conversation_messages: [
                'status',
                'openai_response_id',
                'input_tokens',
                'output_tokens',
            ],
        }

        for (const [table, expectedColumns] of Object.entries(
            expectedMetadataColumns
        )) {
            const columns: Set<string> = new Set(
                firstRun.data?.metadata[table] ?? []
            )
            for (const column of expectedColumns) {
                assert.ok(columns.has(column), `${table}.${column} missing`)
            }
        }

        const secondRun = runMigrationProcess<{ applied: string[] }>(
            'apply',
            databaseUrl
        )
        assert.equal(secondRun.status, 0, secondRun.stderr)
        assert.deepEqual(secondRun.data?.applied, [])

        const verification = runMigrationProcess<{
            applied: Array<{ checksum: string }>
            pending: string[]
        }>('verify', databaseUrl)
        assert.equal(verification.status, 0, verification.stderr)
        assert.equal(verification.data?.applied.length, 4)
        assert.deepEqual(verification.data?.pending, [])
        assert.match(
            verification.data?.applied[0].checksum ?? '',
            /^[a-f0-9]{64}$/
        )

        const copiedMigrations = path.join(
            temporaryDirectory,
            'modified-migrations'
        )
        await cp(migrationsDirectory, copiedMigrations, { recursive: true })
        await appendFile(
            path.join(copiedMigrations, '0002_openai_responses_metadata.sql'),
            '\n-- checksum changed by regression test\n',
            'utf8'
        )

        const invalidChecksum = runMigrationProcess(
            'verify',
            databaseUrl,
            copiedMigrations
        )
        assert.notEqual(invalidChecksum.status, 0)
        assert.match(invalidChecksum.stderr, /Checksum inválido/)
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
    }
})

test('rolls back a failed migration without recording its checksum', async () => {
    const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'buildear-migration-rollback-')
    )
    const copiedMigrations = path.join(temporaryDirectory, 'migrations')
    const databaseUrl = localDatabaseUrl(temporaryDirectory, 'rollback.db')
    await cp(migrationsDirectory, copiedMigrations, { recursive: true })
    await writeFile(
        path.join(copiedMigrations, '0005_intentional_failure.sql'),
        `
            CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY);
            THIS IS NOT VALID SQL;
        `,
        'utf8'
    )

    try {
        const failedRun = runMigrationProcess(
            'apply',
            databaseUrl,
            copiedMigrations
        )
        assert.notEqual(failedRun.status, 0)
        assert.match(failedRun.stderr, /Falló la migración 0005/)

        const inspection = runMigrationProcess<{
            versions: string[]
            rollbackProbeExists: boolean
        }>('inspect', databaseUrl, copiedMigrations)
        assert.equal(inspection.status, 0, inspection.stderr)
        assert.deepEqual(inspection.data?.versions, [
            '0001',
            '0002',
            '0003',
            '0004',
        ])
        assert.equal(inspection.data?.rollbackProbeExists, false)
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
    }
})
