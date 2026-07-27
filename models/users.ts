import type { Row } from '@libsql/client'
import { CloudinaryModel } from '../models/cloudinary.js'
import type {
    IUpdateUser,
    IUser,
    PublicUser,
    UserCredentials,
    UserRole,
} from '../types/user.js'
import { db } from '../utils/consts.js'
import { generatePassword, validPassword } from '../utils/functions.js'

const PUBLIC_USER_COLUMNS = `
    id,
    name,
    surname,
    username,
    email,
    image,
    experience_level,
    completed_profile,
    role,
    created_at,
    updated_at
`

function publicUser(row: Row): PublicUser {
    return {
        id: Number(row.id),
        name: String(row.name),
        surname: String(row.surname),
        username: String(row.username),
        email: String(row.email),
        image: row.image === null ? null : String(row.image),
        experience_level:
            row.experience_level === null ? null : Number(row.experience_level),
        completed_profile: Number(row.completed_profile),
        role: String(row.role) as UserRole,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    }
}

function credentials(row: Row): UserCredentials {
    return {
        ...publicUser(row),
        password: String(row.password),
        password_salt: String(row.password_salt),
        password_algorithm: String(row.password_algorithm),
        password_params: String(row.password_params),
    }
}

export class UserModel {
    static async getAll(): Promise<PublicUser[]> {
        const result = await db.execute(
            `SELECT ${PUBLIC_USER_COLUMNS} FROM users ORDER BY id`
        )
        return result.rows.map(publicUser)
    }

    static async getById(id: number): Promise<PublicUser | undefined> {
        const row = (
            await db.execute({
                sql: `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`,
                args: [id],
            })
        ).rows[0]

        return row ? publicUser(row) : undefined
    }

    static async getByUsername(
        username: string
    ): Promise<PublicUser | undefined> {
        const row = (
            await db.execute({
                sql: `
                    SELECT ${PUBLIC_USER_COLUMNS}
                    FROM users
                    WHERE username = ?
                `,
                args: [username],
            })
        ).rows[0]

        return row ? publicUser(row) : undefined
    }

    static async getCredentialsByUsername(
        username: string
    ): Promise<UserCredentials | undefined> {
        const row = (
            await db.execute({
                sql: `
                    SELECT
                        ${PUBLIC_USER_COLUMNS},
                        password,
                        password_salt,
                        password_algorithm,
                        password_params
                    FROM users
                    WHERE username = ?
                `,
                args: [username],
            })
        ).rows[0]

        return row ? credentials(row) : undefined
    }

    static async getCredentialsById(
        id: number
    ): Promise<UserCredentials | undefined> {
        const row = (
            await db.execute({
                sql: `
                    SELECT
                        ${PUBLIC_USER_COLUMNS},
                        password,
                        password_salt,
                        password_algorithm,
                        password_params
                    FROM users
                    WHERE id = ?
                `,
                args: [id],
            })
        ).rows[0]

        return row ? credentials(row) : undefined
    }

    static async create(
        newUser: Omit<IUser, 'password_salt'>
    ): Promise<PublicUser> {
        const {
            name,
            surname,
            username,
            email,
            password,
            experience_level,
            image,
            completed_profile,
        } = newUser
        const { hash, salt, algorithm, params } =
            await generatePassword(password)
        const imageUrl = image
            ? await CloudinaryModel.uploadImage(
                  image,
                  `${username}-profile-image`,
                  'usersImages'
              )
            : null

        const row = (
            await db.execute({
                sql: `
                    INSERT INTO users (
                        name,
                        surname,
                        username,
                        email,
                        password,
                        password_salt,
                        password_algorithm,
                        password_params,
                        image,
                        experience_level,
                        completed_profile
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING ${PUBLIC_USER_COLUMNS}
                `,
                args: [
                    name,
                    surname,
                    username,
                    email,
                    hash,
                    salt,
                    algorithm,
                    params,
                    imageUrl,
                    experience_level,
                    completed_profile,
                ],
            })
        ).rows[0]

        return publicUser(row)
    }

    static async update(
        userId: number,
        partialUser: IUpdateUser
    ): Promise<PublicUser | undefined> {
        const currentUser = await this.getById(userId)
        if (!currentUser) return undefined

        const updates: string[] = []
        const args: Array<string | number | null> = []

        const addUpdate = (column: string, value: string | number | null) => {
            updates.push(`${column} = ?`)
            args.push(value)
        }

        if (partialUser.username !== undefined)
            addUpdate('username', partialUser.username)
        if (partialUser.email !== undefined)
            addUpdate('email', partialUser.email)
        if (partialUser.experience_level !== undefined)
            addUpdate('experience_level', partialUser.experience_level)
        if (partialUser.completed_profile !== undefined)
            addUpdate('completed_profile', partialUser.completed_profile)
        if (partialUser.image !== undefined) {
            const imageUrl = await CloudinaryModel.uploadImage(
                partialUser.image,
                `${partialUser.username ?? currentUser.username}-profile-image`,
                'usersImages'
            )
            addUpdate('image', imageUrl)
        }

        if (updates.length === 0) return currentUser

        args.push(userId)
        const row = (
            await db.execute({
                sql: `
                    UPDATE users
                    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    RETURNING ${PUBLIC_USER_COLUMNS}
                `,
                args,
            })
        ).rows[0]

        return row ? publicUser(row) : undefined
    }

    static async changePassword(
        userId: number,
        currentPassword: string,
        newPassword: string
    ): Promise<boolean> {
        const user = await this.getCredentialsById(userId)
        if (!user) return false

        const valid = await validPassword(
            currentPassword,
            user.password,
            user.password_salt,
            user.password_algorithm,
            user.password_params
        )
        if (!valid) return false

        await this.replacePasswordHash(userId, newPassword)
        return true
    }

    static async replacePasswordHash(
        userId: number,
        password: string
    ): Promise<void> {
        const { hash, salt, algorithm, params } =
            await generatePassword(password)
        await db.execute({
            sql: `
                UPDATE users
                SET
                    password = ?,
                    password_salt = ?,
                    password_algorithm = ?,
                    password_params = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [hash, salt, algorithm, params, userId],
        })
    }

    static async delete(userId: number): Promise<boolean> {
        const transaction = await db.transaction('write')
        try {
            await transaction.execute({
                sql: 'DELETE FROM auth_sessions WHERE user_id = ?',
                args: [userId],
            })
            const result = await transaction.execute({
                sql: 'DELETE FROM users WHERE id = ?',
                args: [userId],
            })
            await transaction.commit()
            return result.rowsAffected === 1
        } catch (error) {
            await transaction.rollback()
            throw error
        } finally {
            transaction.close()
        }
    }
}
