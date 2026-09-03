import type { Client, Row } from '@libsql/client'

export interface InvalidModelData {
    id: number
    name: string
    height: number
    width: number
    categoryId: number
}

export async function findInvalidModelData(
    client: Client
): Promise<InvalidModelData[]> {
    const result = await client.execute(`
        SELECT id, name, height, width, category_id
        FROM models
        WHERE height <= 0
           OR width <= 0
           OR category_id NOT BETWEEN 1 AND 5
        ORDER BY id
    `)

    return result.rows.map((row: Row) => ({
        id: Number(row.id),
        name: String(row.name),
        height: Number(row.height),
        width: Number(row.width),
        categoryId: Number(row.category_id),
    }))
}
