import * as functions from 'firebase-functions'
import express from 'express'
import cors from 'cors'

// ✅ Import named exports from API files
import { getNutritionData } from './api/nutrition.js'
import { getUPCData } from './api/upc.js'

// ✅ API Express App
const apiApp = express()
apiApp.use(cors({ origin: true }))

// ✅ Route for Nutrition API
apiApp.get('/api/nutrition', getNutritionData)

// ✅ Route for UPC API
apiApp.get('/api/upc', getUPCData)

// ✅ Export API
export const api = functions.https.onRequest(apiApp)
