import { pbkdf2, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { createDatabaseClient } from '../../database/client.js'
import {
    runMigrations,
    verifyDatabaseIntegrity,
    verifyMigrations,
} from '../../database/migrations.js'

const [command, databaseUrl, migrationsDirectory, argument] =
    process.argv.slice(2)
const deriveLegacyPassword = promisify(pbkdf2)

if (!command || !databaseUrl || !migrationsDirectory) {
    throw new Error(
        'Usage: migration-process <command> <database-url> <migrations-directory>'
    )
}

const client = await createDatabaseClient({ url: databaseUrl })

try {
    if (command === 'apply') {
        const applied = await runMigrations(client, migrationsDirectory)
        await verifyDatabaseIntegrity(client)

        const tables = await client.execute(`
            SELECT name
            FROM sqlite_schema
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `)
        const indexes = await client.execute(`
            SELECT name
            FROM sqlite_schema
            WHERE type = 'index' AND name LIKE 'idx_%'
            ORDER BY name
        `)
        const categories = await client.execute(`
            SELECT id, name FROM categories ORDER BY id
        `)
        const foreignKeys = await client.execute('PRAGMA foreign_keys')

        let orphanRejected = false
        try {
            await client.execute({
                sql: 'INSERT INTO favorites (user_id, model_id) VALUES (?, ?)',
                args: [999, 999],
            })
        } catch {
            orphanRejected = true
        }

        const metadata: Record<string, string[]> = {}
        for (const table of [
            'users',
            'models',
            'user_models',
            'conversations',
            'conversation_messages',
        ]) {
            const tableInfo = await client.execute(
                `PRAGMA table_info(${table})`
            )
            metadata[table] = tableInfo.rows.map((row) => String(row.name))
        }

        console.log(
            JSON.stringify({
                applied: applied.map((migration) => migration.version),
                tables: tables.rows.map((row) => String(row.name)),
                indexCount: indexes.rows.length,
                categories: categories.rows.map((row) => String(row.name)),
                foreignKeys: Number(foreignKeys.rows[0]?.foreign_keys),
                orphanRejected,
                metadata,
            })
        )
    } else if (command === 'verify') {
        const state = await verifyMigrations(client, migrationsDirectory)
        await verifyDatabaseIntegrity(client)
        console.log(
            JSON.stringify({
                applied: state.applied,
                pending: state.pending.map((migration) => migration.version),
            })
        )
    } else if (command === 'inspect') {
        const records = await client.execute(`
            SELECT version FROM schema_migrations ORDER BY version
        `)
        const probe = await client.execute(`
            SELECT 1
            FROM sqlite_schema
            WHERE type = 'table' AND name = 'rollback_probe'
        `)
        console.log(
            JSON.stringify({
                versions: records.rows.map((row) => String(row.version)),
                rollbackProbeExists: probe.rows.length > 0,
            })
        )
    } else if (command === 'seed-model') {
        const model = (
            await client.execute({
                sql: `
                    INSERT INTO models (
                        name,
                        description,
                        model_data,
                        model_image,
                        difficulty_rating,
                        category_id,
                        height,
                        width,
                        position
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                `,
                args: [
                    'Modelo inicial',
                    'Modelo de caracterización para pruebas',
                    'https://example.test/model.glb',
                    'https://example.test/model.png',
                    2,
                    1,
                    200,
                    300,
                    'horizontal',
                ],
            })
        ).rows[0]
        console.log(JSON.stringify({ id: Number(model.id) }))
    } else if (command === 'seed-legacy-user') {
        const salt = randomBytes(32).toString('hex')
        const password = (
            await deriveLegacyPassword(
                'legacy-password',
                salt,
                10000,
                64,
                'sha512'
            )
        ).toString('hex')
        const user = (
            await client.execute({
                sql: `
                    INSERT INTO users (
                        name,
                        surname,
                        username,
                        email,
                        password,
                        password_salt,
                        experience_level,
                        completed_profile
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id, username, role, password_algorithm
                `,
                args: [
                    'Legacy',
                    'Tester',
                    'legacy01',
                    'legacy@example.test',
                    password,
                    salt,
                    1,
                    1,
                ],
            })
        ).rows[0]
        console.log(
            JSON.stringify({
                id: Number(user.id),
                username: String(user.username),
                role: String(user.role),
                algorithm: String(user.password_algorithm),
            })
        )
    } else if (command === 'promote-user') {
        if (!argument) throw new Error('promote-user requires a username')
        const result = await client.execute({
            sql: `
                UPDATE users
                SET role = 'admin', updated_at = CURRENT_TIMESTAMP
                WHERE username = ?
            `,
            args: [argument],
        })
        console.log(JSON.stringify({ updated: result.rowsAffected }))
    } else if (command === 'inspect-user') {
        if (!argument) throw new Error('inspect-user requires a username')
        const user = (
            await client.execute({
                sql: `
                    SELECT role, password_algorithm, password_params
                    FROM users
                    WHERE username = ?
                `,
                args: [argument],
            })
        ).rows[0]
        if (!user) throw new Error('User not found')
        console.log(
            JSON.stringify({
                role: String(user.role),
                algorithm: String(user.password_algorithm),
                params: String(user.password_params),
            })
        )
    } else if (command === 'inspect-ai-generations') {
        const records = await client.execute(`
            SELECT
                feature,
                model,
                response_id,
                prompt_version,
                status,
                input_tokens,
                output_tokens,
                latency_ms,
                error_code
            FROM ai_generations
            ORDER BY id
        `)
        console.log(JSON.stringify({ records: records.rows }))
    } else if (command === 'expire-sessions') {
        const result = await client.execute(`
            UPDATE auth_sessions
            SET expires_at = '2000-01-01 00:00:00'
            WHERE revoked_at IS NULL
        `)
        console.log(JSON.stringify({ expired: result.rowsAffected }))
    } else {
        throw new Error(`Unknown test command: ${command}`)
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
} finally {
    client.close()
}
