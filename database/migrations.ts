import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Client, Transaction } from '@libsql/client'

const MIGRATION_FILE_PATTERN = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/i

export interface Migration {
    version: string
    name: string
    checksum: string
    filePath: string
    sql: string
}

export interface AppliedMigration {
    version: string
    name: string
    checksum: string
    appliedAt: string
}

export interface MigrationVerification {
    applied: AppliedMigration[]
    pending: Migration[]
}

export class MigrationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'MigrationError'
    }
}

function checksum(contents: Buffer): string {
    return createHash('sha256').update(contents).digest('hex')
}

export async function discoverMigrations(
    migrationsDirectory: string
): Promise<Migration[]> {
    const entries = await readdir(migrationsDirectory, {
        withFileTypes: true,
    })
    const migrations: Migration[] = []

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.sql')) continue

        const match = MIGRATION_FILE_PATTERN.exec(entry.name)
        if (!match) {
            throw new MigrationError(
                `Nombre de migración inválido: ${entry.name}`
            )
        }

        const [, version, name] = match
        const filePath = path.join(migrationsDirectory, entry.name)
        const contents = await readFile(filePath)

        migrations.push({
            version,
            name,
            checksum: checksum(contents),
            filePath,
            sql: contents.toString('utf8'),
        })
    }

    migrations.sort((left, right) =>
        left.version.localeCompare(right.version, 'en')
    )

    const versions = new Set<string>()
    for (const migration of migrations) {
        if (versions.has(migration.version)) {
            throw new MigrationError(
                `Versión de migración duplicada: ${migration.version}`
            )
        }
        versions.add(migration.version)
    }

    if (migrations.length === 0) {
        throw new MigrationError('No se encontraron migraciones SQL')
    }

    return migrations
}

async function migrationTableExists(client: Client): Promise<boolean> {
    const result = await client.execute({
        sql: `
            SELECT 1 AS present
            FROM sqlite_schema
            WHERE type = 'table' AND name = 'schema_migrations'
        `,
        args: [],
    })

    return result.rows.length === 1
}

async function readAppliedMigrations(
    client: Client
): Promise<AppliedMigration[]> {
    if (!(await migrationTableExists(client))) return []

    const result = await client.execute(`
        SELECT version, name, checksum, applied_at
        FROM schema_migrations
        ORDER BY version
    `)

    return result.rows.map((row) => ({
        version: String(row.version),
        name: String(row.name),
        checksum: String(row.checksum),
        appliedAt: String(row.applied_at),
    }))
}

function validateAppliedMigrations(
    available: Migration[],
    applied: AppliedMigration[]
): void {
    const availableByVersion = new Map(
        available.map((migration) => [migration.version, migration])
    )

    for (const record of applied) {
        const migration = availableByVersion.get(record.version)

        if (!migration) {
            throw new MigrationError(
                `La migración aplicada ${record.version} no existe en migrations/`
            )
        }
        if (migration.name !== record.name) {
            throw new MigrationError(
                `El nombre de la migración ${record.version} no coincide: ` +
                    `${record.name} != ${migration.name}`
            )
        }
        if (migration.checksum !== record.checksum) {
            throw new MigrationError(
                `Checksum inválido para la migración ${record.version}`
            )
        }
    }
}

export async function verifyMigrations(
    client: Client,
    migrationsDirectory: string
): Promise<MigrationVerification> {
    const available = await discoverMigrations(migrationsDirectory)
    const applied = await readAppliedMigrations(client)
    validateAppliedMigrations(available, applied)

    const appliedVersions = new Set(
        applied.map((migration) => migration.version)
    )
    const pending = available.filter(
        (migration) => !appliedVersions.has(migration.version)
    )

    return { applied, pending }
}

async function rollbackQuietly(transaction: Transaction): Promise<void> {
    try {
        await transaction.rollback()
    } catch {
        // Preserve the original migration failure.
    }
}

async function applyMigration(
    client: Client,
    migration: Migration
): Promise<void> {
    const transaction = await client.transaction('write')

    try {
        await transaction.executeMultiple(migration.sql)
        await transaction.execute({
            sql: `
                INSERT INTO schema_migrations (version, name, checksum)
                VALUES (?, ?, ?)
            `,
            args: [migration.version, migration.name, migration.checksum],
        })
        await transaction.commit()
    } catch (error) {
        await rollbackQuietly(transaction)
        throw new MigrationError(
            `Falló la migración ${migration.version}_${migration.name}: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    } finally {
        transaction.close()
    }
}

export async function runMigrations(
    client: Client,
    migrationsDirectory: string
): Promise<Migration[]> {
    const initial = await verifyMigrations(client, migrationsDirectory)
    const appliedNow: Migration[] = []

    for (const migration of initial.pending) {
        const currentState = await verifyMigrations(client, migrationsDirectory)
        if (
            currentState.applied.some(
                (record) => record.version === migration.version
            )
        ) {
            continue
        }

        await applyMigration(client, migration)
        appliedNow.push(migration)
    }

    const finalState = await verifyMigrations(client, migrationsDirectory)
    if (finalState.pending.length > 0) {
        throw new MigrationError(
            `Quedaron ${finalState.pending.length} migraciones pendientes`
        )
    }

    return appliedNow
}

export async function verifyDatabaseIntegrity(client: Client): Promise<void> {
    const integrity = await client.execute('PRAGMA integrity_check')
    const result = String(integrity.rows[0]?.integrity_check)

    if (result !== 'ok') {
        throw new MigrationError(`PRAGMA integrity_check devolvió: ${result}`)
    }

    const foreignKeyViolations = await client.execute(
        'PRAGMA foreign_key_check'
    )
    if (foreignKeyViolations.rows.length > 0) {
        throw new MigrationError(
            `PRAGMA foreign_key_check detectó ${foreignKeyViolations.rows.length} violaciones`
        )
    }
}
