import { v2 as cloudinary } from 'cloudinary'
import { cloudinaryConfig } from '../utils/consts.js'

export type CloudinaryResourceType = 'image' | 'raw'

export interface CloudinaryAsset {
    url: string
    publicId: string
    format: string
    bytes: number
    version: number
    resourceType: CloudinaryResourceType
}

interface UploadOptions {
    folder: string
    public_id: string
    resource_type: CloudinaryResourceType
    overwrite: boolean
}

export interface CloudinaryProvider {
    upload(
        filePath: string,
        options: UploadOptions
    ): Promise<{
        secure_url: string
        public_id: string
        format: string
        bytes: number
        version: number
        resource_type?: string
    }>
    destroy(
        publicId: string,
        options: {
            resource_type: CloudinaryResourceType
            invalidate: boolean
        }
    ): Promise<unknown>
}

cloudinary.config(cloudinaryConfig)

const productionProvider: CloudinaryProvider = {
    upload: (filePath, options) =>
        cloudinary.uploader.upload(filePath, options),
    destroy: (publicId, options) =>
        cloudinary.uploader.destroy(publicId, options),
}

let injectedProvider: CloudinaryProvider | undefined

function provider(): CloudinaryProvider {
    return injectedProvider ?? productionProvider
}

export class CloudinaryModel {
    static setProviderForTests(testProvider?: CloudinaryProvider): void {
        injectedProvider = testProvider
    }

    static async uploadAsset(
        filePath: string,
        publicName: string,
        folderName: string,
        resourceType: CloudinaryResourceType
    ): Promise<CloudinaryAsset> {
        const result = await provider().upload(filePath, {
            folder: folderName,
            public_id: publicName,
            resource_type: resourceType,
            overwrite: false,
        })
        if (!result.secure_url || !result.public_id) {
            throw new Error('Cloudinary returned incomplete asset metadata')
        }
        return {
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            version: result.version,
            resourceType,
        }
    }

    static async uploadImage(
        imagePath: string,
        publicName: string,
        folderName: string
    ): Promise<string> {
        return (
            await this.uploadAsset(imagePath, publicName, folderName, 'image')
        ).url
    }

    static async deleteAsset(
        publicId: string,
        resourceType: CloudinaryResourceType
    ): Promise<void> {
        if (!publicId) return
        await provider().destroy(publicId, {
            resource_type: resourceType,
            invalidate: true,
        })
    }
}
