'use client'
import { useState } from 'react'
import { FoodItem } from '../../types/FoodItem'

type UPCSearchProps = {
  onResult: (results: FoodItem[]) => void
}

export default function UPCSearch({ onResult }: UPCSearchProps) {
  const [upc, setUPC] = useState('')

  const handleUPCSearch = async () => {
    if (!upc.trim()) return

    try {
      const res = await fetch(`/api/upc?upc=${upc}`)
      const data = await res.json()

      if (data.error) {
        alert('No results found')
      } else {
        onResult(data.results)
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
      <button onClick={handleUPCSearch} className="bg-green-500 text-white px-4 py-2 rounded">
        Scan/Search
      </button>
    </div>
  )
}
