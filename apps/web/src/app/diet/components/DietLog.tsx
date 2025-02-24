'use client'
import { useState } from 'react'
import UPCScanner from './UPCScanner'

type LogEntry = {
  date: string
  meal: string
  calories: number
  protein: number
  fat: number
  carbs: number
  notes: string
}

export default function DietLog() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [newEntry, setNewEntry] = useState<LogEntry>({
    date: new Date().toISOString().split('T')[0],
    meal: '',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    notes: ''
  })
  const [showScanner, setShowScanner] = useState(false)

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewEntry(prev => ({
      ...prev,
      [name]: name === 'calories' || name === 'protein' || name === 'fat' || name === 'carbs' ? Number(value) : value
    }))
  }

  // Add new log entry to the list
  const addEntry = () => {
    if (newEntry.meal) {
      setLogEntries(prev => [...prev, newEntry])
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        meal: '',
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        notes: ''
      })
    } else {
      alert('Please enter a meal name before adding.')
    }
  }

  // Handle UPC scan and fetch product data
  const handleScan = async (item: { upc: string }) => {
    try {
      const res = await fetch(`/api/upc?upc=${item.upc}`)
      const data = await res.json()

      if (data.error) {
        alert('Product not found.')
      } else {
        // Auto-fill the form with scanned data
        setNewEntry(prev => ({
          ...prev,
          meal: data.description || 'Scanned Product',
          calories: data.calories || 0,
          protein: data.protein || 0,
          fat: data.fat || 0,
          carbs: data.carbs || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching UPC data', error)
      alert('Failed to fetch product data.')
    }
  }

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Diet Log</h2>

      {/* 📝 Diet Log Form */}
      <div className="grid grid-cols-2 gap-4">
        <input
          type="date"
          name="date"
          value={newEntry.date}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="meal"
          placeholder="Meal"
          value={newEntry.meal}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="calories"
          placeholder="Calories"
          value={newEntry.calories}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="protein"
          placeholder="Protein (g)"
          value={newEntry.protein}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="fat"
          placeholder="Fat (g)"
          value={newEntry.fat}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="carbs"
          placeholder="Carbs (g)"
          value={newEntry.carbs}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <textarea
          name="notes"
          placeholder="Notes"
          value={newEntry.notes}
          onChange={handleChange}
          className="border p-2 rounded col-span-2"
        />
      </div>

      {/* 📷 UPC Scanner & Add Entry Buttons */}
      <div className="flex gap-4 my-4">
        <button
          onClick={addEntry}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Meal
        </button>
        <button
          onClick={() => setShowScanner(!showScanner)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          {showScanner ? 'Close Scanner' : 'Scan UPC'}
        </button>
      </div>

      {/* 📷 UPC Scanner Component */}
      {showScanner && <UPCScanner onScan={handleScan} />}

      {/* 📊 Logged Meals List */}
      <h3 className="text-lg font-bold mt-4">Logged Meals:</h3>
      {logEntries.length === 0 ? (
        <p className="text-gray-500">No meals logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {logEntries.map((entry, idx) => (
            <li key={idx} className="border p-2 rounded">
              <strong>{entry.date}</strong> - {entry.meal}<br />
              Calories: {entry.calories} kcal | Protein: {entry.protein}g | Fat: {entry.fat}g | Carbs: {entry.carbs}g<br />
              Notes: {entry.notes}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
