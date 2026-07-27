import crypto from 'crypto'
import { promisify } from 'node:util'

const pbkdf2 = promisify(crypto.pbkdf2)

export const LEGACY_PASSWORD_ALGORITHM = 'pbkdf2-sha512'
export const CURRENT_PASSWORD_ALGORITHM = 'scrypt'

interface Pbkdf2Params {
    iterations: number
    keyLength: number
    digest: string
}

interface ScryptParams {
    cost: number
    blockSize: number
    parallelization: number
    keyLength: number
    maxmem: number
}

const LEGACY_PBKDF2_PARAMS: Pbkdf2Params = {
    iterations: 10000,
    keyLength: 64,
    digest: 'sha512',
}

const CURRENT_SCRYPT_PARAMS: ScryptParams = {
    cost: 2 ** 15,
    blockSize: 8,
    parallelization: 3,
    keyLength: 64,
    maxmem: 64 * 1024 * 1024,
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) > 0
}

function parsePbkdf2Params(serialized?: string): Pbkdf2Params | undefined {
    if (!serialized) return LEGACY_PBKDF2_PARAMS

    try {
        const parsed = JSON.parse(serialized) as Partial<Pbkdf2Params>
        if (
            !isPositiveInteger(parsed.iterations) ||
            !isPositiveInteger(parsed.keyLength) ||
            parsed.digest !== 'sha512'
        ) {
            return undefined
        }
        return {
            iterations: parsed.iterations,
            keyLength: parsed.keyLength,
            digest: parsed.digest,
        }
    } catch {
        return undefined
    }
}

function parseScryptParams(serialized: string): ScryptParams | undefined {
    try {
        const parsed = JSON.parse(serialized) as Partial<ScryptParams>
        if (
            !isPositiveInteger(parsed.cost) ||
            !isPositiveInteger(parsed.blockSize) ||
            !isPositiveInteger(parsed.parallelization) ||
            !isPositiveInteger(parsed.keyLength) ||
            !isPositiveInteger(parsed.maxmem)
        ) {
            return undefined
        }
        return {
            cost: parsed.cost,
            blockSize: parsed.blockSize,
            parallelization: parsed.parallelization,
            keyLength: parsed.keyLength,
            maxmem: parsed.maxmem,
        }
    } catch {
        return undefined
    }
}

async function legacyPasswordHash(
    password: string,
    salt: string,
    params: Pbkdf2Params
): Promise<Buffer> {
    return pbkdf2(
        password,
        salt,
        params.iterations,
        params.keyLength,
        params.digest
    )
}

async function scryptPasswordHash(
    password: string,
    salt: string,
    params: ScryptParams
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(
            password,
            salt,
            params.keyLength,
            {
                cost: params.cost,
                blockSize: params.blockSize,
                parallelization: params.parallelization,
                maxmem: params.maxmem,
            },
            (error, derivedKey) => {
                if (error) reject(error)
                else resolve(derivedKey)
            }
        )
    })
}

export async function generatePassword(password: string) {
    const salt = crypto.randomBytes(32).toString('hex')
    const genHash = (
        await scryptPasswordHash(password, salt, CURRENT_SCRYPT_PARAMS)
    ).toString('hex')
    return {
        salt,
        hash: genHash,
        algorithm: CURRENT_PASSWORD_ALGORITHM,
        params: JSON.stringify(CURRENT_SCRYPT_PARAMS),
    }
}

export async function validPassword(
    password: string,
    hash: string,
    salt: string,
    algorithm = LEGACY_PASSWORD_ALGORITHM,
    serializedParams?: string
) {
    if (!/^[a-f0-9]+$/i.test(hash) || hash.length % 2 !== 0) return false

    const expected = Buffer.from(hash, 'hex')
    let actual: Buffer

    if (algorithm === CURRENT_PASSWORD_ALGORITHM) {
        const params = serializedParams
            ? parseScryptParams(serializedParams)
            : undefined
        if (!params) return false
        actual = await scryptPasswordHash(password, salt, params)
    } else if (algorithm === LEGACY_PASSWORD_ALGORITHM) {
        const params = parsePbkdf2Params(serializedParams)
        if (!params) return false
        actual = await legacyPasswordHash(password, salt, params)
    } else {
        return false
    }

    return (
        expected.length === actual.length &&
        crypto.timingSafeEqual(expected, actual)
    )
}

export function passwordNeedsRehash(
    algorithm: string,
    serializedParams: string
): boolean {
    if (algorithm !== CURRENT_PASSWORD_ALGORITHM) return true
    const params = parseScryptParams(serializedParams)
    return (
        !params ||
        params.cost !== CURRENT_SCRYPT_PARAMS.cost ||
        params.blockSize !== CURRENT_SCRYPT_PARAMS.blockSize ||
        params.parallelization !== CURRENT_SCRYPT_PARAMS.parallelization ||
        params.keyLength !== CURRENT_SCRYPT_PARAMS.keyLength
    )
}
