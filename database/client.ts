import { createClient, type Client, type Config } from '@libsql/client'

export function isLocalDatabaseUrl(url: string): boolean {
    return url.startsWith('file:')
}

export async function enableLocalForeignKeys(
    client: Client,
    databaseUrl: string
): Promise<void> {
    if (!isLocalDatabaseUrl(databaseUrl)) return

    await client.execute('PRAGMA foreign_keys = ON')
    const result = await client.execute('PRAGMA foreign_keys')
    const enabled = Number(result.rows[0]?.foreign_keys)

    if (enabled !== 1) {
        throw new Error('No se pudieron activar las foreign keys en SQLite')
    }
}

export async function createDatabaseClient(config: Config): Promise<Client> {
    const client = createClient(config)

    try {
        await enableLocalForeignKeys(client, config.url)
        return client
    } catch (error) {
        client.close()
        throw error
    }
}
