import cors from 'cors'
import express, { Router } from 'express'
import fileUpload from 'express-fileupload'
import { tmpdir } from 'node:os'
import { corsOptions } from './middleware/cors.js'
import { errorHandler, notFound, requestContext } from './middleware/errors.js'
import { legacyApiHeaders, securityHeaders } from './middleware/security.js'
import { authRouter } from './routes/auth.js'
import { conversationMessageRouter } from './routes/conversationMessages.js'
import { conversationRouter } from './routes/conversations.js'
import { favoritesRouter } from './routes/favorites.js'
import { healthRouter } from './routes/health.js'
import { modelsRouter } from './routes/models.js'
import { openAIRouter } from './routes/openAI.js'
import { userModelsRouter } from './routes/userModels.js'
import { usersRouter } from './routes/users.js'

function uploadFileSizeLimit(): number {
    const configured = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES)
    return Number.isInteger(configured) && configured > 0
        ? configured
        : 20 * 1024 * 1024
}

export const app = express()

app.set('trust proxy', 1)

app.disable('x-powered-by')
app.use(requestContext)
app.use(securityHeaders)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cors(corsOptions))
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: process.env.UPLOAD_TEMP_DIR || tmpdir(),
        limits: { fileSize: uploadFileSizeLimit() },
        abortOnLimit: true,
        safeFileNames: true,
        preserveExtension: 4,
        createParentPath: false,
    })
)

app.get('/', (_request, response) => {
    response.send('Página de inicio')
})

app.use('/health', healthRouter)

function apiRouter(): Router {
    const router = Router()
    router.use('/users', usersRouter)
    router.use('/openai', openAIRouter)
    router.use('/models', modelsRouter)
    router.use('/userModels', userModelsRouter)
    router.use('/auth', authRouter)
    router.use('/favorites', favoritesRouter)
    router.use('/conversation', conversationRouter)
    router.use('/conversationMessage', conversationMessageRouter)
    return router
}

app.use('/api/v1', apiRouter())
app.use(legacyApiHeaders, apiRouter())

app.use(notFound)
app.use(errorHandler)
