import { Request, Response } from 'express'
import fetch from 'node-fetch'

export const getNutritionData = async (req: Request, res: Response) => {
  const query = req.query.query as string | undefined
  const upc = req.query.upc as string | undefined

  // ✅ If neither query nor upc is provided, return an error
  if (!query && !upc) {
    return res.status(400).json({ error: 'Either query or upc parameter is required' })
  }

  try {
    let apiUrl = ''

    if (query) {
      // ✅ Text Search API
      apiUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1`
    } else if (upc) {
      // ✅ UPC Lookup API
      apiUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upc)}.json`
    }

    const response = await fetch(apiUrl)
    const data = await response.json()

    if (upc) {
      // ✅ Handling UPC-specific response
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
    } else {
      // ✅ Text Search Result
      return res.status(200).json(data)
    }
  } catch (error) {
    console.error('Nutrition API Error:', error)
    return res.status(500).json({ error: 'Failed to fetch data' })
  }
}
