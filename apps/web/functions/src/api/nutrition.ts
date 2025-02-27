import { Request, Response } from 'express'
import fetch from 'node-fetch'

const OPENFOODFACTS_API = 'https://world.openfoodfacts.org'
const USDA_API_KEY = process.env.USDA_API_KEY // Make sure to set this in Firebase config
const USDA_API = 'https://api.nal.usda.gov/fdc/v1/foods/search'

export const getNutritionData = async (req: Request, res: Response) => {
  const query = req.query.query as string | undefined
  const upc = req.query.upc as string | undefined

  if (!query && !upc) {
    return res.status(400).json({ error: 'Either query or upc parameter is required' })
  }

  try {
    let results = []

    /** ✅ Search OpenFoodFacts */
    if (query) {
      const openFoodUrl = `${OPENFOODFACTS_API}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1`
      const openFoodRes = await fetch(openFoodUrl)
      const openFoodData = await openFoodRes.json()

      if (openFoodData.products && openFoodData.products.length > 0) {
        results.push(
          ...openFoodData.products.map((product: any) => formatOpenFoodFactsProduct(product))
        )
      }
    } else if (upc) {
      const openFoodUrl = `${OPENFOODFACTS_API}/api/v0/product/${encodeURIComponent(upc)}.json`
      const openFoodRes = await fetch(openFoodUrl)
      const openFoodData = await openFoodRes.json()

      if (openFoodData.status !== 0) {
        results.push(formatOpenFoodFactsProduct(openFoodData.product))
      }
    }

    /** ✅ Search USDA */
    if (query || upc) {
      const usdaUrl = `${USDA_API}?query=${encodeURIComponent(query || upc!)}&api_key=${USDA_API_KEY}`
      const usdaRes = await fetch(usdaUrl)
      const usdaData = await usdaRes.json()

      if (usdaData.foods && usdaData.foods.length > 0) {
        results.push(
          ...usdaData.foods.map((food: any) => formatUsdaProduct(food))
        )
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'No products found' })
    }

    return res.status(200).json(results)
  } catch (error) {
    console.error('Nutrition API Error:', error)
    return res.status(500).json({ error: 'Failed to fetch data' })
  }
}

/** ✅ Format OpenFoodFacts Response */
const formatOpenFoodFactsProduct = (product: any) => ({
  description: product.product_name || 'Unknown Product',
  brand: product.brands || 'Unknown Brand',
  calories: product.nutriments?.['energy-kcal'] || 0,
  protein: product.nutriments?.proteins || 0,
  fat: product.nutriments?.fat || 0,
  carbs: product.nutriments?.carbohydrates || 0,
  fiber: product.nutriments?.fiber || 0,
  sugars: product.nutriments?.sugars || 0,
  sodium: product.nutriments?.sodium || 0,
  cholesterol: product.nutriments?.cholesterol || 0,
  upc: product.code || 'N/A',
  source: 'OpenFoodFacts'
})

/** ✅ Format USDA Response */
const formatUsdaProduct = (food: any) => {
  const nutrients = food.foodNutrients.reduce((acc: any, nutrient: any) => {
    if (nutrient.nutrientName.includes('Energy')) acc.calories = nutrient.value || 0
    if (nutrient.nutrientName.includes('Protein')) acc.protein = nutrient.value || 0
    if (nutrient.nutrientName.includes('Total lipid')) acc.fat = nutrient.value || 0
    if (nutrient.nutrientName.includes('Carbohydrate')) acc.carbs = nutrient.value || 0
    if (nutrient.nutrientName.includes('Fiber')) acc.fiber = nutrient.value || 0
    if (nutrient.nutrientName.includes('Sugars')) acc.sugars = nutrient.value || 0
    if (nutrient.nutrientName.includes('Sodium')) acc.sodium = nutrient.value || 0
    if (nutrient.nutrientName.includes('Cholesterol')) acc.cholesterol = nutrient.value || 0
    return acc
  }, {})

  return {
    description: food.description || 'Unknown Product',
    brand: food.brandOwner || 'Unknown Brand',
    ...nutrients,
    upc: food.gtinUpc || 'N/A',
    source: 'USDA'
  }
}
