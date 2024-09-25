import { ExperienceLevel } from '../enums/experienceLevel.ts'

export interface IUser {
    id?: number
    username: string
    email: string
    password: string
    experienceLevel: ExperienceLevel
    created_at?: string
    updated_at?: string
}
