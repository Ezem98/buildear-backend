import { IFavorite } from '../types/favorite.js'
import { db } from '../utils/consts.js'

export class FavoriteModel {
    static async create(newFavorite: IFavorite) {
        try {
            const { user_id, model_id } = newFavorite

            await db.execute({
                sql: `
                    INSERT INTO favorites (user_id, model_id)
                    VALUES (?, ?)
                `,
                args: [user_id, model_id],
            })

            const favorite = (
                await db.execute({
                    sql: 'SELECT * FROM favorites WHERE user_id = ? AND model_id = ?',
                    args: [user_id, model_id],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'Favorite created',
                data: favorite,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async get(userId: number, modelId: number) {
        try {
            const favorite = (
                await db.execute({
                    sql: `SELECT * FROM favorites WHERE user_id = ? AND model_id = ?`,
                    args: [userId, modelId],
                })
            ).rows[0]

            if (!favorite) return false

            return true
        } catch (error: any) {
            return false
        }
    }

    static async delete(userId: string, modelId: string) {
        try {
            await db.execute({
                sql: 'DELETE FROM favorites WHERE user_id = ? AND model_id = ?',
                args: [userId, modelId],
            })

            return { successfully: true, message: 'Favorite deleted' }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }
}
