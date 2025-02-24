export interface FoodNutrient {
  nutrientId: number
  nutrientName: string
  unitName: string
  value: number
}

export interface FoodItem {
  fdcId: number
  description: string
  foodNutrients: FoodNutrient[]
}

export interface NutritionResponse {
  foods: FoodItem[]
}
