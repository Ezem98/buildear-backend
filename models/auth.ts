import type { PublicUser } from '../types/user.js'
import { passwordNeedsRehash, validPassword } from '../utils/functions.js'
import { UserModel } from './users.js'

export class AuthModel {
    static async login(
        username: string,
        password: string
    ): Promise<PublicUser | undefined> {
        const user = await UserModel.getCredentialsByUsername(username)
        if (!user) return undefined

        const valid = await validPassword(
            password,
            user.password,
            user.password_salt,
            user.password_algorithm,
            user.password_params
        )
        if (!valid) return undefined

        if (
            passwordNeedsRehash(user.password_algorithm, user.password_params)
        ) {
            await UserModel.replacePasswordHash(user.id, password)
        }

        const {
            password: _password,
            password_salt: _salt,
            password_algorithm: _algorithm,
            password_params: _params,
            ...publicUser
        } = user
        return publicUser
    }
}
