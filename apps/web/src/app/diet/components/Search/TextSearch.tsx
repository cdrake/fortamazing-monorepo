'use client'
import { useState } from 'react'
import { FoodItem } from '../../types/FoodItem'
import { USDAFoodItem } from '../../types/USDAFoodItem'
import { mapUSDAFoodItemToFoodItem } from '../../utils/mapUSDAFoodItem'

type TextSearchProps = {
  onResult: (results: FoodItem[]) => void
}

export default function TextSearch({ onResult }: TextSearchProps) {
  const [searchText, setSearchText] = useState<string>('')

  const handleSearch = async () => {
    if (!searchText.trim()) {
      alert('Please enter a search term')
      return
    }

    try {
      const res = await fetch(`/api/nutrition?query=${encodeURIComponent(searchText)}`)
      const data: { foods?: USDAFoodItem[] } = await res.json()

      console.log('USDA API Response:', data)

      const parsedResults: FoodItem[] = (data as []).map((item) => 
         mapUSDAFoodItemToFoodItem(item)      
      )

      console.log('Mapped Results:', parsedResults)

      if (parsedResults.length > 0) {
        onResult(parsedResults)
      } else {
        alert('No results found')
        onResult([])
      }
    } catch (error) {
      console.error('Text search error:', error)
      onResult([])
    }
  }

  return (
    <div className="flex gap-2 my-4">
      <input
        type="text"
        placeholder="Search for food (e.g., Apple, Banana)"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="border p-2 rounded flex-grow"
      />
      <button
        onClick={handleSearch}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Search
      </button>
    </div>
  )
}
