import { randomUUID } from 'node:crypto'
import type {
    ImageFormat,
    ModelFormat,
    ValidatedUpload,
} from '../services/uploads.js'
import { IModel } from '../types/model.js'
import { db } from '../utils/consts.js'
import { CloudinaryModel, type CloudinaryAsset } from './cloudinary.js'

export interface ModelAssetUploads {
    modelData?: ValidatedUpload<ModelFormat>
    modelImage?: ValidatedUpload<ImageFormat>
}

function assetPublicName(name: string, suffix: string): string {
    const safeName =
        name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'model'
    return `${safeName}-${randomUUID()}-${suffix}`
}

async function deleteAssets(assets: CloudinaryAsset[]): Promise<void> {
    await Promise.allSettled(
        assets.map((asset) =>
            CloudinaryModel.deleteAsset(asset.publicId, asset.resourceType)
        )
    )
}

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

    static async create(newModel: IModel, uploads: ModelAssetUploads) {
        const uploadedAssets: CloudinaryAsset[] = []
        try {
            const {
                name,
                description,
                difficulty_rating,
                category_id,
                height,
                width,
                position,
            } = newModel
            if (!uploads.modelData || !uploads.modelImage) {
                throw new Error('Both model assets are required')
            }

            const modelAsset = await CloudinaryModel.uploadAsset(
                uploads.modelData.path,
                assetPublicName(name, 'model-data'),
                'modelsData',
                'raw'
            )
            uploadedAssets.push(modelAsset)
            const imageAsset = await CloudinaryModel.uploadAsset(
                uploads.modelImage.path,
                assetPublicName(name, 'model-image'),
                'modelsImages',
                'image'
            )
            uploadedAssets.push(imageAsset)

            const model = (
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
                        position,
                        model_public_id,
                        image_public_id,
                        model_format,
                        model_size_bytes,
                        model_checksum
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                `,
                    args: [
                        name,
                        description ?? null,
                        modelAsset.url,
                        imageAsset.url,
                        difficulty_rating ?? null,
                        category_id,
                        height,
                        width,
                        position,
                        modelAsset.publicId,
                        imageAsset.publicId,
                        uploads.modelData.format,
                        uploads.modelData.sizeBytes,
                        uploads.modelData.checksum,
                    ],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'Model created',
                data: model,
            }
        } catch (error) {
            await deleteAssets(uploadedAssets)
            return {
                successfully: false,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Model creation failed',
            }
        }
    }

    static async update(
        id: number,
        partialModel: Partial<IModel>,
        uploads: ModelAssetUploads = {}
    ) {
        const uploadedAssets: CloudinaryAsset[] = []
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
                difficulty_rating,
                category_id,
                height,
                width,
                position,
            } = partialModel
            const assetName = name ?? String(currentModel.name)
            const modelAsset = uploads.modelData
                ? await CloudinaryModel.uploadAsset(
                      uploads.modelData.path,
                      assetPublicName(assetName, 'model-data'),
                      'modelsData',
                      'raw'
                  )
                : undefined
            if (modelAsset) uploadedAssets.push(modelAsset)
            const imageAsset = uploads.modelImage
                ? await CloudinaryModel.uploadAsset(
                      uploads.modelImage.path,
                      assetPublicName(assetName, 'model-image'),
                      'modelsImages',
                      'image'
                  )
                : undefined
            if (imageAsset) uploadedAssets.push(imageAsset)

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
                        model_public_id = ?,
                        image_public_id = ?,
                        model_format = ?,
                        model_size_bytes = ?,
                        model_checksum = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `,
                args: [
                    name ?? currentModel.name,
                    description ?? currentModel.description,
                    modelAsset?.url ?? currentModel.model_data,
                    imageAsset?.url ?? currentModel.model_image,
                    difficulty_rating ?? currentModel.difficulty_rating,
                    category_id ?? currentModel.category_id,
                    height ?? currentModel.height,
                    width ?? currentModel.width,
                    position ?? currentModel.position,
                    modelAsset?.publicId ?? currentModel.model_public_id,
                    imageAsset?.publicId ?? currentModel.image_public_id,
                    uploads.modelData?.format ?? currentModel.model_format,
                    uploads.modelData?.sizeBytes ??
                        currentModel.model_size_bytes,
                    uploads.modelData?.checksum ?? currentModel.model_checksum,
                    id,
                ],
            })

            const updatedModel = (
                await db.execute({
                    sql: 'SELECT * FROM models WHERE id = ?',
                    args: [id],
                })
            ).rows[0]

            const replacedAssets: CloudinaryAsset[] = []
            if (modelAsset && currentModel.model_public_id) {
                replacedAssets.push({
                    url: String(currentModel.model_data),
                    publicId: String(currentModel.model_public_id),
                    format: String(currentModel.model_format ?? ''),
                    bytes: Number(currentModel.model_size_bytes ?? 0),
                    version: 0,
                    resourceType: 'raw',
                })
            }
            if (imageAsset && currentModel.image_public_id) {
                replacedAssets.push({
                    url: String(currentModel.model_image),
                    publicId: String(currentModel.image_public_id),
                    format: '',
                    bytes: 0,
                    version: 0,
                    resourceType: 'image',
                })
            }
            await deleteAssets(replacedAssets)

            return {
                successfully: true,
                message: 'Model updated',
                data: updatedModel,
            }
        } catch (error) {
            await deleteAssets(uploadedAssets)
            return {
                successfully: false,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Model update failed',
            }
        }
    }

    static async delete(id: number) {
        try {
            const currentModel = (
                await db.execute({
                    sql: `
                        SELECT
                            model_public_id,
                            image_public_id,
                            model_data,
                            model_image,
                            model_format,
                            model_size_bytes
                        FROM models
                        WHERE id = ?
                    `,
                    args: [id],
                })
            ).rows[0]
            if (!currentModel) {
                return {
                    successfully: false,
                    message: 'Model not found',
                }
            }

            const result = await db.execute({
                sql: 'DELETE FROM models WHERE id = ?',
                args: [id],
            })
            if (result.rowsAffected !== 1) {
                return {
                    successfully: false,
                    message: 'Model not found',
                }
            }

            const deletedAssets: CloudinaryAsset[] = []
            if (currentModel.model_public_id) {
                deletedAssets.push({
                    url: String(currentModel.model_data),
                    publicId: String(currentModel.model_public_id),
                    format: String(currentModel.model_format ?? ''),
                    bytes: Number(currentModel.model_size_bytes ?? 0),
                    version: 0,
                    resourceType: 'raw',
                })
            }
            if (currentModel.image_public_id) {
                deletedAssets.push({
                    url: String(currentModel.model_image),
                    publicId: String(currentModel.image_public_id),
                    format: '',
                    bytes: 0,
                    version: 0,
                    resourceType: 'image',
                })
            }
            await deleteAssets(deletedAssets)

            return { successfully: true, message: 'Model deleted' }
        } catch (error) {
            return {
                successfully: false,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Model deletion failed',
            }
        }
    }
}
