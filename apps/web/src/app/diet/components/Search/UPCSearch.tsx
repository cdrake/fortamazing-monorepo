'use client'
import { useState } from 'react'
import { FoodItem } from '../../types/FoodItem'

type UPCSearchProps = {
  onResult: (results: FoodItem[]) => void
}

export default function UPCSearch({ onResult }: UPCSearchProps) {
  const [upc, setUPC] = useState('')

  const handleUPCSearch = async () => {
    if (!upc.trim()) {
      alert('Please enter a UPC code')
      return
    }

    try {
      const res = await fetch(`/api/nutrition?upc=${encodeURIComponent(upc)}`)
      const results: FoodItem[] = await res.json()

      console.log('UPC Search API Response:', results)

      if (results.length > 0) {
        onResult(results)
      } else {
        alert('No results found')
        onResult([])
      }
    } catch (error) {
      console.error('UPC search error:', error)
      alert('Failed to fetch data')
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Enter UPC code"
        value={upc}
        onChange={(e) => setUPC(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <button
        onClick={handleUPCSearch}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Scan/Search
      </button>
    </div>
  )
}
