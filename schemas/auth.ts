import z from 'zod'

export const loginSchema = z
    .object({
        username: z.string().min(1).max(100),
        password: z.string().min(1).max(256),
    })
    .strict()

export const refreshSchema = z
    .object({
        refresh_token: z.string().min(32).max(256),
    })
    .strict()
