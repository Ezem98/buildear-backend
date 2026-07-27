import { IGuide } from '../types/guide.js'

export interface IUserModel {
    id?: number
    user_id: number
    model_id: number
    completed: number
    current_step: number
    guide: IGuide
    createdAt?: string
    updatedAt?: string
}
