import { IModel } from '../types/model.js'
import { db } from '../utils/consts.js'
import { CloudinaryModel } from './cloudinary.js'

export class ModelModel {
    static async getAll() {
        try {
            const models = (await db.execute('SELECT * FROM models')).rows

            if (!models.length)
                return {
                    successfully: false,
                    message: 'No models found',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getById(id: number) {
        try {
            const model = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE id = ?',
                    args: [id],
                })
            ).rows[0]

            if (!model)
                return {
                    successfully: false,
                    message: 'Model not found',
                }

            return {
                successfully: true,
                message: 'Model found',
                data: model,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getByCategoryId(categoryId: number) {
        try {
            const models = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE category_id = ?',
                    args: [categoryId],
                })
            ).rows

            if (!models)
                return {
                    successfully: false,
                    message: 'Models not found for this category',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getByName(name: string) {
        try {
            const models = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE LOWER(name) LIKE LOWER(?)',
                    args: [`%${name}%`],
                })
            ).rows

            if (!models)
                return {
                    successfully: true,
                    message: 'Models not found for this query',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getByUserId(userId: string) {
        try {
            const models = (
                await db.execute({
                    sql: 'SELECT m.* FROM models m JOIN user_models  um ON m.id = um.model_id WHERE um.user_id = ?',
                    args: [userId],
                })
            ).rows

            if (!models)
                return {
                    successfully: true,
                    message: 'Models not found for this user id',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getFavorites(userId: string) {
        try {
            const models = (
                await db.execute({
                    sql: 'SELECT m.* FROM models m JOIN favorites f ON m.id = f.model_id WHERE f.user_id = ?',
                    args: [userId],
                })
            ).rows

            if (!models)
                return {
                    successfully: true,
                    message: 'Models not found for this user id',
                }

            return {
                successfully: true,
                message: 'Models found',
                data: models,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async create(newModel: IModel) {
        try {
            const {
                name,
                description,
                data,
                difficulty_rating,
                image,
                category_id,
                height,
                width,
                position,
            } = newModel

            // const modelDataUrl = await CloudinaryModel.uploadImage(
            //     data,
            //     `${name}-model-data`,
            //     'modelsData'
            // )

            const imageUrl = await CloudinaryModel.uploadImage(
                image,
                `${name}-model-image`,
                'modelsImages'
            )

            await db.execute({
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
                `,
                args: [
                    name,
                    description ?? null,
                    '',
                    imageUrl,
                    difficulty_rating ?? null,
                    category_id,
                    height,
                    width,
                    position,
                ],
            })

            const model = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE name = ?',
                    args: [name],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'Model created',
                data: model,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async update(id: number, partialModel: Partial<IModel>) {
        try {
            const currentModel = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE id = ?',
                    args: [id],
                })
            ).rows[0]

            if (!currentModel)
                return {
                    successfully: false,
                    message: 'Model not found',
                }

            const {
                name,
                description,
                data,
                image,
                difficulty_rating,
                category_id,
                height,
                width,
                position,
            } = partialModel
            const assetName = name ?? String(currentModel.name)
            const modelDataUrl = data
                ? await CloudinaryModel.uploadImage(
                      data,
                      `${assetName}-model-data`,
                      'modelsData'
                  )
                : undefined
            const imageUrl = image
                ? await CloudinaryModel.uploadImage(
                      image,
                      `${assetName}-model-image`,
                      'modelsImages'
                  )
                : undefined

            await db.execute({
                sql: `
                    UPDATE models
                    SET
                        name = ?,
                        description = ?,
                        model_data = ?,
                        model_image = ?,
                        difficulty_rating = ?,
                        category_id = ?,
                        height = ?,
                        width = ?,
                        position = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `,
                args: [
                    name ?? currentModel.name,
                    description ?? currentModel.description,
                    modelDataUrl ?? currentModel.model_data,
                    imageUrl ?? currentModel.model_image,
                    difficulty_rating ?? currentModel.difficulty_rating,
                    category_id ?? currentModel.category_id,
                    height ?? currentModel.height,
                    width ?? currentModel.width,
                    position ?? currentModel.position,
                    id,
                ],
            })

            const updatedModel = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE id = ?',
                    args: [id],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'Model updated',
                data: updatedModel,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async delete(id: number) {
        try {
            await db.execute({
                sql: 'DELETE FROM models WHERE id = ?',
                args: [id],
            })

            return { successfully: true, message: 'Model deleted' }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }
}
