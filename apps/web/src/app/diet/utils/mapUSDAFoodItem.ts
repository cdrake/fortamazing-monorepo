import { USDAFoodItem, USDAFoodNutrient } from '../types/USDAFoodItem'
import { FoodItem } from '../types/FoodItem'

export const mapUSDAFoodItemToFoodItem = (usdaItem: USDAFoodItem): FoodItem => {
  const extractNutrient = (nutrients: USDAFoodNutrient[], nutrientName: string): number => {
    return nutrients.find((n) => n.nutrientName === nutrientName)?.value ?? 0
  }

  return {
    id: usdaItem.fdcId.toString(),
    description: usdaItem.description,
    brandOwner: usdaItem.brandOwner,
    upc: usdaItem.gtinUpc,
    ingredients: usdaItem.ingredients,
    servingSize: usdaItem.servingSize,
    servingSizeUnit: usdaItem.servingSizeUnit,
    foodCategory: usdaItem.foodCategory,
    calories: extractNutrient(usdaItem.foodNutrients, 'Energy'),
    protein: extractNutrient(usdaItem.foodNutrients, 'Protein'),
    fat: extractNutrient(usdaItem.foodNutrients, 'Total lipid (fat)'),
    carbs: extractNutrient(usdaItem.foodNutrients, 'Carbohydrate, by difference'),
    fiber: extractNutrient(usdaItem.foodNutrients, 'Fiber, total dietary'),
    sugars: extractNutrient(usdaItem.foodNutrients, 'Sugars, total'),
    sodium: extractNutrient(usdaItem.foodNutrients, 'Sodium, Na'),
    cholesterol: extractNutrient(usdaItem.foodNutrients, 'Cholesterol'),
    source: 'USDA'
  }
}
