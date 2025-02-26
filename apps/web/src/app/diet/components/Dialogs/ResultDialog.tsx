'use client'
import { FoodItem } from '../../types/FoodItem'

type ResultDialogProps = {
  results: FoodItem[]
  onSelect: (item: FoodItem) => void
  onClose: () => void
}

export default function ResultDialog({ results, onSelect, onClose }: ResultDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Select a Food Item</h2>

        {/* ✅ Scrollable list */}
        <ul className="space-y-2 max-h-64 overflow-y-auto border rounded p-2">
          {results.map((item) => (
            <li
              key={item.id}
              className="p-2 border rounded cursor-pointer hover:bg-gray-100"
              onClick={() => onSelect(item)}
            >
              <strong>{item.description}</strong> — {item.calories} kcal
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full"
        >
          Close
        </button>
      </div>
    </div>
  )
}
