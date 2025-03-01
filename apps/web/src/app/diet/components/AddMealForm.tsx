'use client'
import { useEffect, useState } from 'react'
import { Meal } from '../types/meal'

export default function AddMealForm({
  initialData,
  onSave,
  onCancel
}: {
  initialData?: Meal
  onSave: (meal: Meal) => void
  onCancel: () => void
}) {
  const getDefaultMealTime = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 21) return 'dinner'
    return 'snack'
  }

  const [formData, setFormData] = useState<Meal>(
    initialData || {
      id: '',
      description: '',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
      sugars: 0,
      sodium: 0,
      cholesterol: 0,
      source: 'OpenFoodFacts',
      mealTime: getDefaultMealTime()
    }
  )

  useEffect(() => {
    if (initialData) {
      setFormData({...initialData, mealTime: getDefaultMealTime()})
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(formData)
      }}
      className="border p-4 rounded shadow-md bg-white"
    >
      <h3 className="text-xl font-bold mb-2">Add Meal</h3>
      
      <div className="mb-4 font-bold">
        Total: {formData.calories} k | {formData.carbs} c | {formData.protein} p | {formData.fat} f
      </div>
      
      <label className="block mb-2">
        Meal Time:
        <select
          name="mealTime"
          value={formData.mealTime}
          onChange={handleChange}
          className="border p-2 w-full"
        >
          <option value="unspecified">Unspecified</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </label>

      <label className="block mb-2">
        Description:
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <label className="block mb-2">
        Calories:
        <input
          type="number"
          name="calories"
          value={formData.calories}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <label className="block mb-2">
        Protein (g):
        <input
          type="number"
          name="protein"
          value={formData.protein}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <label className="block mb-2">
        Fat (g):
        <input
          type="number"
          name="fat"
          value={formData.fat}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <label className="block mb-2">
        Carbs (g):
        <input
          type="number"
          name="carbs"
          value={formData.carbs}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <label className="block mb-2">
        Fiber (g):
        <input
          type="number"
          name="fiber"
          value={formData.fiber}
          onChange={handleChange}
          className="border p-2 w-full"
        />
      </label>

      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save Meal
        </button>
      </div>
    </form>
  )
}
