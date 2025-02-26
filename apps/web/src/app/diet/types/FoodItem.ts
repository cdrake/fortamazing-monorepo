// types/FoodItem.ts
export interface FoodNutrient {
  nutrientName: string
  value: number
}

export type FoodItem = {
  id: string
  description: string
  brandOwner?: string
  upc?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  foodCategory?: string
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber?: number
  sugars?: number
  sodium?: number
  cholesterol?: number
  source: 'USDA' | 'OpenFoodFacts'
}

