import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import routes from './routes'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 19485

app.use(cors())
app.use(express.json())

app.use('/api', routes)

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '自来水厂药剂投加偏差复核系统 API 运行正常' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`API base URL: http://localhost:${PORT}/api`)
})

export default app
