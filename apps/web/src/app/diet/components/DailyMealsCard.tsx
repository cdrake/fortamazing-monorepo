'use client'
import { FoodItem } from '../types/FoodItem'

interface DailyMealsCardProps {
  date: string
  meals: FoodItem[]
}

export default function DailyMealsCard({ date, meals }: DailyMealsCardProps) {
  const getDailyTotals = (meals: FoodItem[]) => {
    return meals.reduce(
      (totals, meal) => {
        totals.calories += meal.calories || 0
        totals.carbs += meal.carbs || 0
        totals.protein += meal.protein || 0
        totals.fat += meal.fat || 0
        return totals
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    )
  }

  const totals = getDailyTotals(meals)

  return (
    <div className="p-4 border rounded-lg shadow-md mt-4">
      <h3 className="text-lg font-bold">Meals for {date}:</h3>
      {meals.length === 0 ? (
        <p className="text-gray-500">No meals logged for this date.</p>
      ) : (
        <ul className="space-y-4">
          {meals.map((meal) => (
            <li key={meal.id} className="border p-4 rounded shadow-sm">
              <h4 className="font-bold text-lg">{meal.description}</h4>
              <p>k: {meal.calories} | c: {meal.carbs}g | p: {meal.protein}g | f: {meal.fat}g</p>
            </li>
          ))}
        </ul>
      )}
      <h3 className="text-lg font-bold mt-4">Daily Totals:</h3>
      <p>k: {totals.calories} | c: {totals.carbs}g | p: {totals.protein}g | f: {totals.fat}g</p>
    </div>
  )
}