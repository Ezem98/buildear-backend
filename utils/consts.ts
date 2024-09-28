import { createClient } from '@libsql/Client'
import { ExperienceLevel } from '../enums/experienceLevel.ts'

export const EXPERIENCE_LEVEL: Record<ExperienceLevel, string> = {
    [ExperienceLevel.BEGINNER]: 'poca experiencia',
    [ExperienceLevel.INTERMEDIATE]: 'experiencia intermedia',
    [ExperienceLevel.ADVANCED]: 'mucha experiencia',
}

// #region Turso
const config = {
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
}

export const db = createClient(config)

// #region Cloudinary
export const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
}
