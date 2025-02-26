import { Request, Response } from 'express'
import fetch from 'node-fetch'

export const getUPCData = async (req: Request, res: Response) => {
  const upc = req.query.upc as string

  if (!upc) {
    return res.status(400).json({ error: 'UPC parameter is required' })
  }

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upc)}.json`)
    const data = await response.json()

    if (data.status === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const product = data.product

    return res.status(200).json({
      description: product.product_name || 'Unknown Product',
      brand: product.brands || 'Unknown Brand',
      calories: product.nutriments['energy-kcal'] || 0,
      protein: product.nutriments.proteins || 0,
      fat: product.nutriments.fat || 0,
      carbs: product.nutriments.carbohydrates || 0,
      fiber: product.nutriments.fiber || 0,
      sugars: product.nutriments.sugars || 0,
      sodium: product.nutriments.sodium || 0,
      cholesterol: product.nutriments.cholesterol || 0,
      upc: upc,
      source: 'OpenFoodFacts'
    })
  } catch (error) {
    console.error('UPC API Error:', error)
    return res.status(500).json({ error: 'Failed to fetch UPC data' })
  }
}
