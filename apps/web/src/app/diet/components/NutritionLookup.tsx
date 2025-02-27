'use client'
import { useState } from 'react'
import type { FoodItem, FoodNutrient } from '../types/nutrition'

export default function NutritionLookup() {
  const [query, setQuery] = useState<string>('')
  const [results, setResults] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fortamazing.com/api'

  const handleSearch = async () => {
    if (!query) return

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/nutrition?query=${encodeURIComponent(query)}`)
      const list = await response.json()
      const data: FoodItem[] = list.products

      setResults(data)
    } catch (error) {
      console.error('Error fetching nutrition data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNutrientValue = (nutrients: FoodNutrient[], name: string): number => {
    return nutrients.find(n => n.nutrientName === name)?.value || 0
  }

  return (
    <div>
      <h2>Nutrition Lookup</h2>
      <input
        type="text"
        placeholder="Search for food (e.g., Apple)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      {results.length > 0 && (
        <ul>
          {results.map((food) => (
            <li key={food.fdcId}>
              <strong>{food.description}</strong> - {getNutrientValue(food.foodNutrients, 'Energy')} kcal |
              Protein: {getNutrientValue(food.foodNutrients, 'Protein')}g |
              Fat: {getNutrientValue(food.foodNutrients, 'Total lipid (fat)')}g |
              Carbs: {getNutrientValue(food.foodNutrients, 'Carbohydrate, by difference')}g
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
