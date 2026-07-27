import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { createDatabaseClient } from '../database/client.js'
import {
    runMigrations,
    verifyDatabaseIntegrity,
    verifyMigrations,
} from '../database/migrations.js'

const migrationsDirectory = fileURLToPath(
    new URL('../migrations', import.meta.url)
)
const command = process.argv[2] ?? 'apply'
const databaseUrl = process.env.TURSO_DATABASE_URL ?? 'file:local.db'
const client = await createDatabaseClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

try {
    if (command === 'apply') {
        const applied = await runMigrations(client, migrationsDirectory)
        await verifyDatabaseIntegrity(client)
        console.log(
            applied.length === 0
                ? 'Migraciones al día; no se aplicaron cambios.'
                : `Migraciones aplicadas: ${applied
                      .map((migration) => migration.version)
                      .join(', ')}`
        )
    } else if (command === 'verify') {
        const state = await verifyMigrations(client, migrationsDirectory)
        if (state.pending.length > 0) {
            throw new Error(
                `Migraciones pendientes: ${state.pending
                    .map((migration) => migration.version)
                    .join(', ')}`
            )
        }
        await verifyDatabaseIntegrity(client)
        console.log(
            `Migraciones verificadas: ${state.applied.length}; integridad OK.`
        )
    } else {
        throw new Error(`Comando desconocido: ${command}`)
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
} finally {
    client.close()
}
