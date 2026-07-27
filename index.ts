import 'dotenv/config'
import { app } from './app.js'

const port = process.env.PORT ?? 1234

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})
