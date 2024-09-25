import { db } from '../turso.ts'
import { IUser } from '../types/user.ts'

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

    static async create(newUser: IUser) {
        try {
            const { username, email, password, experienceLevel } = newUser

            await db.batch(
                [
                    `
                            CREATE TABLE IF NOT EXISTS users (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                username TEXT NOT NULL UNIQUE,
                                email TEXT NOT NULL UNIQUE,
                                password TEXT NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                                experience_level INTEGER
                            );
                        `,
                    {
                        sql: `
                            INSERT INTO users (username, email, password, experience_level) VALUES
                            (?, ?, ?, ?);
                        `,
                        args: [username, email, password, experienceLevel],
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

    static async update(currentUserName: string, partialUser: Partial<IUser>) {
        const { username, email, password, experienceLevel } = partialUser

        try {
            const currentUser = (
                await db.execute({
                    sql: 'SELECT * FROM users WHERE username = ?',
                    args: [currentUserName],
                })
            ).rows[0]

            await db.batch(
                [
                    {
                        sql: `UPDATE users
                        SET username = ?,
                            email = ?,
                            password = ?,
                            experience_level = ?
                        WHERE
                            username = ?;`,
                        args: [
                            username ?? currentUser.username,
                            email ?? currentUser.email,
                            password ?? currentUser.password,
                            experienceLevel ?? currentUser.experience_level,
                            currentUserName,
                        ],
                    },
                ],
                'write'
            )

            const updatedUser = (
                await db.execute({
                    sql: 'SELECT * FROM users WHERE username = ?',
                    args: [username ?? currentUserName],
                })
            ).rows[0]

            return {
                successfully: true,
                message: 'User updated',
                data: updatedUser,
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
