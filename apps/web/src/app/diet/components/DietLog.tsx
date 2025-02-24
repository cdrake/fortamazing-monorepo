'use client'
import { useState } from 'react'

type LogEntry = {
  date: string
  meal: string
  calories: number
  notes: string
}

export default function DietLog() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [newEntry, setNewEntry] = useState<LogEntry>({ date: '', meal: '', calories: 0, notes: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewEntry(prev => ({ ...prev, [name]: name === 'calories' ? Number(value) : value }))
  }

  const addEntry = () => {
    if (newEntry.date && newEntry.meal) {
      setLogEntries(prev => [...prev, newEntry])
      setNewEntry({ date: '', meal: '', calories: 0, notes: '' })
    }
  }

  return (
    <div>
      <h2>Your Diet Log</h2>
      <div>
        <input type="date" name="date" value={newEntry.date} onChange={handleChange} />
        <input type="text" name="meal" placeholder="Meal" value={newEntry.meal} onChange={handleChange} />
        <input type="number" name="calories" placeholder="Calories" value={newEntry.calories} onChange={handleChange} />
        <textarea name="notes" placeholder="Notes" value={newEntry.notes} onChange={handleChange} />
        <button onClick={addEntry}>Add Meal</button>
      </div>

      <ul>
        {logEntries.map((entry, idx) => (
          <li key={idx}>
            <strong>{entry.date}</strong>: {entry.meal} ({entry.calories} cal) - {entry.notes}
          </li>
        ))}
      </ul>
    </div>
  )
}
