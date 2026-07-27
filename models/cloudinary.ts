import { v2 as cloudinary } from 'cloudinary'
import { cloudinaryConfig } from '../utils/consts.js'

cloudinary.config(cloudinaryConfig)
export class CloudinaryModel {
    static async uploadImage(
        imageUrl: string,
        publicName: string,
        folderName: string
    ) {
        // Upload an image
        const uploadResult = await cloudinary.uploader
            .upload(imageUrl, {
                folder: folderName,
                public_id: publicName,
            })
            .catch((error: any) => {
                console.log(error)
            })

        return uploadResult?.secure_url ?? ''
    }
}
