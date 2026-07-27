import z from 'zod'
import { IFavorite } from '../types/favorite.js'

export const favoriteSchema = z
    .object({
        user_id: z.number().positive().int(),
        model_id: z.number().positive().int(),
    })
    .strict()

export const validFavoriteData = (favoriteData: unknown) => {
    return favoriteSchema.safeParse(favoriteData)
}

export const validPartialFavoriteData = (favoriteData: IFavorite) => {
    return favoriteSchema.partial().safeParse(favoriteData)
}
