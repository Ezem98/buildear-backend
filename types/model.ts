import { Position } from './position.js'

export interface IModel {
    id?: number
    name: string
    description: string
    data: string
    image: string
    category_id: number
    width: number
    height: number
    position: Position
    difficulty_rating?: number
    created_at?: string
    updated_at?: string
}
