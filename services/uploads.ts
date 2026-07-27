import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { UploadedFile } from 'express-fileupload'
import { AppError } from '../errors/appError.js'

export type ModelFormat = 'glb' | 'gltf'
export type ImageFormat = 'jpg' | 'png' | 'webp'

export interface ValidatedUpload<TFormat extends string> {
    path: string
    format: TFormat
    sizeBytes: number
    checksum: string
}

const MODEL_MIME_TYPES: Record<ModelFormat, ReadonlySet<string>> = {
    glb: new Set(['model/gltf-binary', 'application/octet-stream']),
    gltf: new Set([
        'model/gltf+json',
        'application/json',
        'application/octet-stream',
    ]),
}

const IMAGE_MIME_TYPES: Record<ImageFormat, ReadonlySet<string>> = {
    jpg: new Set(['image/jpeg']),
    png: new Set(['image/png']),
    webp: new Set(['image/webp']),
}

function configuredLimit(name: string, fallback: number): number {
    const configured = Number(process.env[name])
    return Number.isInteger(configured) && configured > 0
        ? configured
        : fallback
}

function singleFile(
    value: UploadedFile | UploadedFile[] | undefined,
    field: string,
    required: boolean
): UploadedFile | undefined {
    if (value === undefined) {
        if (required) {
            throw new AppError(
                400,
                'MODEL_FILE_REQUIRED',
                `El archivo ${field} es obligatorio`
            )
        }
        return undefined
    }
    if (Array.isArray(value)) {
        throw new AppError(
            400,
            'MULTIPLE_FILES_NOT_ALLOWED',
            `El campo ${field} acepta un solo archivo`
        )
    }
    if (value.truncated) {
        throw new AppError(
            413,
            'UPLOAD_TOO_LARGE',
            `El archivo ${field} supera el límite permitido`
        )
    }
    if (!value.tempFilePath) {
        throw new AppError(
            400,
            'UPLOAD_TEMP_FILE_MISSING',
            `No se pudo procesar el archivo ${field}`
        )
    }
    return value
}

async function checksum(filePath: string): Promise<string> {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(filePath)) hash.update(chunk)
    return hash.digest('hex')
}

async function header(filePath: string, size = 12): Promise<Buffer> {
    const handle = await open(filePath, 'r')
    try {
        const buffer = Buffer.alloc(size)
        const { bytesRead } = await handle.read(buffer, 0, size, 0)
        return buffer.subarray(0, bytesRead)
    } finally {
        await handle.close()
    }
}

async function validateGltf(filePath: string): Promise<boolean> {
    try {
        const parsed = JSON.parse(await readFile(filePath, 'utf8')) as {
            asset?: { version?: unknown }
        }
        return (
            typeof parsed.asset?.version === 'string' &&
            parsed.asset.version.startsWith('2.')
        )
    } catch {
        return false
    }
}

function detectedImageFormat(bytes: Buffer): ImageFormat | undefined {
    if (
        bytes.length >= 8 &&
        bytes
            .subarray(0, 8)
            .equals(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            )
    ) {
        return 'png'
    }
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return 'jpg'
    }
    if (
        bytes.length >= 12 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'webp'
    }
    return undefined
}

export async function validateModelUpload(
    value: UploadedFile | UploadedFile[] | undefined,
    required: boolean
): Promise<ValidatedUpload<ModelFormat> | undefined> {
    const file = singleFile(value, 'modelData', required)
    if (!file) return undefined

    const limit = configuredLimit(
        'UPLOAD_MODEL_MAX_FILE_SIZE_BYTES',
        20 * 1024 * 1024
    )
    if (file.size <= 0 || file.size > limit) {
        throw new AppError(
            413,
            'MODEL_FILE_SIZE_INVALID',
            'El archivo 3D supera el límite permitido'
        )
    }

    const extension = path.extname(file.name).toLowerCase().slice(1)
    if (extension !== 'glb' && extension !== 'gltf') {
        throw new AppError(
            415,
            'MODEL_FORMAT_UNSUPPORTED',
            'El archivo 3D debe ser GLB o glTF 2.x'
        )
    }
    if (!MODEL_MIME_TYPES[extension].has(file.mimetype.toLowerCase())) {
        throw new AppError(
            415,
            'MODEL_MIME_UNSUPPORTED',
            'El tipo MIME del archivo 3D no es válido'
        )
    }

    const bytes = await header(file.tempFilePath)
    const signatureIsValid =
        extension === 'glb'
            ? bytes.toString('ascii', 0, 4) === 'glTF' &&
              bytes.readUInt32LE(4) === 2
            : await validateGltf(file.tempFilePath)
    if (!signatureIsValid) {
        throw new AppError(
            415,
            'MODEL_CONTENT_INVALID',
            'El contenido no corresponde a un archivo glTF 2.x válido'
        )
    }

    return {
        path: file.tempFilePath,
        format: extension,
        sizeBytes: file.size,
        checksum: await checksum(file.tempFilePath),
    }
}

export async function validateImageUpload(
    value: UploadedFile | UploadedFile[] | undefined,
    required: boolean
): Promise<ValidatedUpload<ImageFormat> | undefined> {
    const file = singleFile(value, 'modelImage', required)
    if (!file) return undefined

    const limit = configuredLimit(
        'UPLOAD_IMAGE_MAX_FILE_SIZE_BYTES',
        5 * 1024 * 1024
    )
    if (file.size <= 0 || file.size > limit) {
        throw new AppError(
            413,
            'IMAGE_FILE_SIZE_INVALID',
            'La imagen supera el límite permitido'
        )
    }

    const format = detectedImageFormat(await header(file.tempFilePath))
    if (!format) {
        throw new AppError(
            415,
            'IMAGE_CONTENT_INVALID',
            'La imagen debe ser JPEG, PNG o WebP'
        )
    }
    const extension = path.extname(file.name).toLowerCase().slice(1)
    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension
    if (
        normalizedExtension !== format ||
        !IMAGE_MIME_TYPES[format].has(file.mimetype.toLowerCase())
    ) {
        throw new AppError(
            415,
            'IMAGE_TYPE_MISMATCH',
            'La extensión, el MIME y el contenido de la imagen no coinciden'
        )
    }

    return {
        path: file.tempFilePath,
        format,
        sizeBytes: file.size,
        checksum: await checksum(file.tempFilePath),
    }
}
