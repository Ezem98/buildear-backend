import { CloudinaryModel } from '../models/cloudinary.ts'
import { IUpdateUser, IUser } from '../types/user.ts'
import { db } from '../utils/consts.ts'
import { generatePassword, validPassword } from '../utils/functions.ts'

export class UserModel {
    static async getAll() {
        try {
            const users = (await db.execute('SELECT * FROM users')).rows

            if (!users.length)
                return {
                    successfully: false,
                    message: 'No users found',
                }

            return {
                successfully: true,
                message: 'Users found',
                data: users,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async getByUsername(username: string) {
        try {
            const user = (
                await db.execute({
                    sql: 'SELECT * FROM users WHERE username = ?',
                    args: [username],
                })
            ).rows[0]

            if (!user)
                return {
                    successfully: false,
                    message: 'User not found',
                }

            return {
                successfully: true,
                message: 'User found',
                data: user,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async create(newUser: Omit<IUser, 'password_salt'>) {
        try {
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

            const { hash, salt } = generatePassword(password)

            let imageUrl: string | undefined

            if (image)
                imageUrl = await CloudinaryModel.uploadImage(
                    image,
                    `${username}-profile-image`,
                    'usersImages'
                )

            await db.batch(
                [
                    `
                            CREATE TABLE IF NOT EXISTS users (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT NOT NULL,
                                surname TEXT NOT NULL,
                                username TEXT NOT NULL UNIQUE,
                                email TEXT NOT NULL UNIQUE,
                                password TEXT NOT NULL,
                                password_salt TEXT NOT NULL,
                                image TEXT,
                                experience_level INTEGER,
                                completed_profile INTEGER DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                            );
                        `,
                    {
                        sql: `
                            INSERT INTO users (name, surname, username, email, password, password_salt, image, experience_level, completed_profile) VALUES
                            (?, ?, ?, ?, ?, ?, ?, ?, ?);
                        `,
                        args: [
                            name,
                            surname,
                            username,
                            email,
                            hash,
                            salt,
                            imageUrl ?? null,
                            experience_level,
                            completed_profile,
                        ],
                    },
                ],

                'write'
            )

            const user = (
                await db.execute({
                    sql: 'SELECT * FROM users WHERE username = ?',
                    args: [username],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'User created',
                data: user,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async update(
        currentUserName: string,
        partialUser: Partial<IUpdateUser>
    ) {
        const {
            username,
            email,
            password,
            newPassword,
            image,
            experience_level,
            completed_profile,
        } = partialUser

        let hash: string | undefined,
            salt: string | undefined,
            imageUrl: string | undefined

        try {
            const { data: currentUser } = await this.getByUsername(
                currentUserName
            )

            if (!currentUser)
                return { successfully: false, message: 'User not found' }

            if (password && newPassword) {
                const valid = validPassword(
                    password,
                    currentUser.password as string,
                    currentUser.password_salt as string
                )
                if (valid) {
                    const result = generatePassword(newPassword)
                    hash = result.hash
                    salt = result.salt
                }
            }

            if (image)
                imageUrl = await CloudinaryModel.uploadImage(
                    image,
                    `${username}-profile-image`,
                    'usersImages'
                )

            await db.batch(
                [
                    {
                        sql: `UPDATE users
                        SET username = ?,
                            email = ?,
                            password = ?,
                            password_salt = ?,
                            image = ?,
                            experience_level = ?,
                            completed_profile = ?
                        WHERE
                            username = ?;`,
                        args: [
                            username ?? currentUser.username,
                            email ?? currentUser.email,
                            hash ?? currentUser.password,
                            salt ?? currentUser.password_salt,
                            imageUrl ?? currentUser.image,
                            experience_level ?? currentUser.experience_level,
                            completed_profile ?? currentUser.completed_profile,
                            currentUserName,
                        ],
                    },
                ],
                'write'
            )

            const { data } = await this.getByUsername(
                username ?? currentUserName
            )

            return {
                successfully: true,
                message: 'User updated',
                data: data,
            }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }

    static async delete(username: string) {
        try {
            await db.execute({
                sql: 'DELETE FROM users WHERE username = ?',
                args: [username],
            })

            return { successfully: true, message: 'User deleted' }
        } catch (error: any) {
            return { successfully: false, message: error.message }
        }
    }
}
