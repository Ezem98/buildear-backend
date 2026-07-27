import { IUserModel } from '../types/userModel.js'
import { db } from '../utils/consts.js'

export class UserModelModel {
    static async getAllByUserId(userId: number) {
        try {
            const models = (
                await db.execute({
                    sql: 'SELECT * FROM user_models WHERE user_id = ?',
                    args: [userId],
                })
            ).rows

            if (!models.length)
                return {
                    successfully: false,
                    message: 'No models found for user with that id',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            if (
                error.message ===
                'SQLITE_UNKNOWN: SQLite error: no such table: user_models'
            )
                return {
                    successfully: true,
                    message: 'No model found for this user id',
                }

            return { successfully: false, message: error.message }
        }
    }

    static async getAllByModelId(modelId: number, userId: number) {
        try {
            const models = (
                await db.execute({
                    sql: `
                        SELECT *
                        FROM user_models
                        WHERE model_id = ? AND user_id = ?
                    `,
                    args: [modelId, userId],
                })
            ).rows

            if (!models.length)
                return {
                    successfully: true,
                    message: 'Models not found for model with that id',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            if (
                error.message ===
                'SQLITE_UNKNOWN: SQLite error: no such table: user_models'
            )
                return {
                    successfully: true,
                    message: 'No model found for this user id',
                }

            return { successfully: false, message: error.message }
        }
    }

    static async get(userId: number, modelId: number) {
        try {
            const userModel = (
                await db.execute({
                    sql: `SELECT * FROM user_models WHERE user_id = ? AND model_id = ?`,
                    args: [userId, modelId],
                })
            ).rows[0]

            if (!userModel)
                return {
                    successfully: true,
                    message: 'User Model not found',
                }

            return {
                successfully: true,
                message: 'User Model found',
                data: userModel,
            }
        } catch (error: any) {
            if (
                error.message ===
                'SQLITE_UNKNOWN: SQLite error: no such table: user_models'
            )
                return {
                    successfully: true,
                    message: 'No model found for this user id',
                }
            return {
                successfully: false,
                message: error.message,
            }
        }
    }

    static async create(newUserModel: IUserModel) {
        try {
            const { user_id, model_id, completed, current_step, guide } =
                newUserModel

            await db.execute({
                sql: `
                    INSERT INTO user_models (
                        user_id,
                        model_id,
                        completed,
                        current_step,
                        guide
                    )
                    VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    user_id,
                    model_id,
                    completed,
                    current_step,
                    JSON.stringify(guide),
                ],
            })

            const userModel = (
                await db.execute({
                    sql: 'SELECT * FROM user_models WHERE user_id = ? AND model_id = ?',
                    args: [user_id, model_id],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'User Model created',
                data: userModel,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async update(
        id: number,
        userId: number,
        partialUserModel: Partial<IUserModel>
    ) {
        const { completed, current_step } = partialUserModel

        try {
            const currentUserModel = (
                await db.execute({
                    sql: `
                        SELECT *
                        FROM user_models
                        WHERE id = ? AND user_id = ?
                    `,
                    args: [id, userId],
                })
            ).rows[0]

            if (!currentUserModel)
                return {
                    successfully: false,
                    message: 'User Model not found',
                }

            await db.execute({
                sql: `UPDATE user_models
                        SET completed = ?,
                            current_step = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE
                            id = ? AND user_id = ?`,
                args: [
                    completed ?? currentUserModel.completed,
                    current_step ?? currentUserModel.current_step,
                    id,
                    userId,
                ],
            })

            const updatedUserModel = (
                await db.execute({
                    sql: `
                        SELECT *
                        FROM user_models
                        WHERE id = ? AND user_id = ?
                    `,
                    args: [id, userId],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'User Model updated',
                data: updatedUserModel,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async delete(userId: number, modelId: number) {
        try {
            await db.execute({
                sql: 'DELETE FROM user_models WHERE user_id = ? AND model_id = ?',
                args: [userId, modelId],
            })

            return { successfully: true, message: 'Model deleted' }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }
}
