import * as functions from 'firebase-functions'
import express from 'express'
import cors from 'cors'
import next from 'next/dist/server/next.js'
import { fileURLToPath } from 'url'





import path from 'path'
import fs from 'fs'
import { existsSync, renameSync } from 'fs'

// ✅ Import named exports from API files
import { getNutritionData } from './api/nutrition.js'
import { getUPCData } from './api/upc.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FONT_MANIFEST_PATH = path.join(process.cwd(), '.next/server/font-manifest.json')
const ALT_FONT_MANIFEST_PATH = path.join(process.cwd(), '.next/server/next-font-manifest.json')



// try {
//   const fontManifestPath = path.resolve('.next', 'server', 'font-manifest.json')
//   if (fs.existsSync(fontManifestPath)) {
//     const fontManifest = fs.readFileSync(fontManifestPath, 'utf-8')
//     console.log('Font manifest loaded:', fontManifest)
//   } else {
//     console.warn('Font manifest not found, continuing without it.')
//   }
// } catch (err) {
//   console.error('Error loading font manifest:', err)
// }
// ✅ If next-font-manifest.json exists, rename it to font-manifest.json
// if (existsSync(ALT_FONT_MANIFEST_PATH)) {
//   console.warn('⚠️ Using next-font-manifest.json instead of font-manifest.json...')
//   renameSync(ALT_FONT_MANIFEST_PATH, FONT_MANIFEST_PATH)
// }

// ✅ Next.js App Setup
const dev = process.env.NODE_ENV !== 'production'
const nextApp = (next as unknown as (opts: any) => any)({
  dev,
  conf: {
    distDir: path.resolve(__dirname, '../.next'),
    dir: path.resolve(__dirname, '../src'),    
    optimizeFonts: false, // ✅ Disable font optimization
    
  }
})
// const nextApp: ReturnType<typeof next> = next({
//   dev,
//   conf: {
//     distDir: path.resolve(__dirname, '../.next'),
//     dir: path.resolve(__dirname, '../src'),    
//     optimizeFonts: false, // ✅ Disable font optimization
    
//   }
// })


const handle = nextApp.getRequestHandler()

const app = express()

nextApp.prepare().then(() => {
  app.all('*', (req, res) => handle(req, res))
})

// ✅ Export Next.js Handler
export const nextAppHandler = functions.https.onRequest(app)

// ✅ API Express App
const apiApp = express()
apiApp.use(cors({ origin: true }))

// ✅ Route for Nutrition API
apiApp.get('/api/nutrition', getNutritionData)

// ✅ Route for UPC API
apiApp.get('/api/upc', getUPCData)

// ✅ Export API
export const api = functions.https.onRequest(apiApp)
