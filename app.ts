import cors from 'cors'
import express from 'express'
import fileUpload from 'express-fileupload'
import { corsOptions } from './middleware/cors.js'
import { errorHandler, notFound, requestContext } from './middleware/errors.js'
import { authRouter } from './routes/auth.js'
import { conversationMessageRouter } from './routes/conversationMessages.js'
import { conversationRouter } from './routes/conversations.js'
import { favoritesRouter } from './routes/favorites.js'
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

app.disable('x-powered-by')
app.use(requestContext)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cors(corsOptions))
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: process.env.UPLOAD_TEMP_DIR ?? '/tmp/',
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

app.use('/users', usersRouter)
app.use('/openai', openAIRouter)
app.use('/models', modelsRouter)
app.use('/userModels', userModelsRouter)
app.use('/auth', authRouter)
app.use('/favorites', favoritesRouter)
app.use('/conversation', conversationRouter)
app.use('/conversationMessage', conversationMessageRouter)

app.use(notFound)
app.use(errorHandler)
