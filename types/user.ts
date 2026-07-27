import { ExperienceLevel } from '../enums/experienceLevel.js'

export type UserRole = 'user' | 'admin'

export interface IUser {
    id?: number
    name: string
    surname: string
    username: string
    email: string
    password: string
    password_salt: string
    experience_level: ExperienceLevel
    image?: string
    completed_profile: number
    role?: UserRole
    created_at?: string
    updated_at?: string
}

export interface PublicUser {
    id: number
    name: string
    surname: string
    username: string
    email: string
    experience_level: ExperienceLevel | null
    image: string | null
    completed_profile: number
    role: UserRole
    created_at: string
    updated_at: string
}

export interface UserCredentials extends PublicUser {
    password: string
    password_salt: string
    password_algorithm: string
    password_params: string
}

export interface IUpdateUser {
    username?: string
    email?: string
    image?: string
    experience_level?: ExperienceLevel
    completed_profile?: number
}

export interface IUpdatePassword {
    password: string
    newPassword: string
}
