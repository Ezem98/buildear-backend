import z from 'zod'
import { ExperienceLevel } from '../enums/experienceLevel.js'

export const userSchema = z
    .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        surname: z.string().min(2, 'Surname must be at least 2 characters'),
        username: z.string().min(6, 'Username must be at least 6 characters'),
        email: z.email('Invalid email format'),
        password: z
            .string()
            .min(8, 'Password must contain at least 8 characters')
            .max(256),
        image: z.string().optional(),
        experience_level: z
            .number()
            .int()
            .min(ExperienceLevel.BEGINNER)
            .max(
                ExperienceLevel.ADVANCED,
                'Experience level must be at most 3'
            ),
        completed_profile: z.number().int().min(0).max(1).default(0),
    })
    .strict()

export const validUserData = (userData: unknown) => {
    return userSchema.safeParse(userData)
}

export const updateUserSchema = z
    .object({
        username: z.string().min(6, 'Username must be at least 6 characters'),
        email: z.string().email('Invalid email format'),
        image: z.string().optional(),
        experience_level: z
            .number()
            .int()
            .positive()
            .max(
                ExperienceLevel.ADVANCED,
                'Experience level must be at most 3'
            ),
        completed_profile: z.number().int().min(0).max(1),
    })
    .strict()

export const validPartialUserData = (userData: unknown) => {
    return updateUserSchema.partial().safeParse(userData)
}

export const updatePasswordSchema = z
    .object({
        password: z.string().min(1).max(256),
        newPassword: z
            .string()
            .min(8, 'New password must contain at least 8 characters')
            .max(256),
    })
    .strict()

export const validUpdatePasswordData = (userData: unknown) => {
    return updatePasswordSchema.safeParse(userData)
}
