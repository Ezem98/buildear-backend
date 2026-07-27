import 'dotenv/config'
import { app } from './app.js'
import { db } from './utils/consts.js'

const port = process.env.PORT ?? 1234

const server = app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})

let shuttingDown = false

function shutdown(signal: NodeJS.Signals): void {
    if (shuttingDown) return
    shuttingDown = true

    const forceExit = setTimeout(() => {
        process.exit(1)
    }, 10_000)
    forceExit.unref()

    server.close((error) => {
        clearTimeout(forceExit)
        db.close()
        if (error) {
            console.error({ code: 'HTTP_SHUTDOWN_FAILED', signal })
            process.exitCode = 1
            return
        }
        process.exitCode = 0
    })
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
