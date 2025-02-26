export type USDAFoodNutrient = {
  nutrientName: string
  value: number
  unitName?: string
}

export type USDAFoodItem = {
  fdcId: number
  description: string
  dataType: string
  brandOwner?: string
  gtinUpc?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  foodCategory?: string
  foodNutrients: USDAFoodNutrient[]
}
