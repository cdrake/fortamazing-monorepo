'use client'
import { useState, useEffect } from 'react'
import { FoodItem } from '../types/FoodItem'
import TextSearch from './Search/TextSearch'
import UPCScanner from './Search/UPCScanner'
import ResultDialog from './Dialogs/ResultDialog'
import AddMealForm from './AddMealForm'
import { db, auth, collection, setDoc, getDocs, query, doc } from '../../../lib/firebase'
import { serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged, User } from 'firebase/auth'

export default function DietLog() {
  const [logEntries, setLogEntries] = useState<FoodItem[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null)
  const [loading, setLoading] = useState(true)

  // ✅ Fetch Meals from Firestore on Mount
  
  const fetchMeals = async (user: User | null) => {
    if (!user) {
      setLoading(false)
      return
    }

    const mealsQuery = query(collection(db, `users/${user.uid}/meals`))
    const querySnapshot = await getDocs(mealsQuery)
    console.log('query snap', querySnapshot)
    const meals: FoodItem[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FoodItem))

    setLogEntries(meals)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchMeals(user)
      } else {
        setLogEntries([]) // Clear meals if logged out
        setLoading(false)
      }
    })
  
    return () => unsubscribe() // Cleanup listener
  }, [])

  // ✅ Save Meal to Firestore
  const handleAddMeal = async (meal: FoodItem) => {
    const user = auth.currentUser
    if (!user) {
      alert('You must be logged in to save meals.')
      return
    }

    try {
      const mealId = crypto.randomUUID()
      // ✅ Use user's UID for document path
      const mealRef = doc(db, `users/${user.uid}/meals/${mealId}`)
      meal.id = mealId
      console.log('✅ Meal saved:', mealRef.id)
      await setDoc(mealRef, {
        ...meal,
        userId: user.uid,
        createdAt: serverTimestamp(),  // ✅ Add timestamp
        updatedAt: serverTimestamp()
      })
      setLogEntries(prev => [...prev, { ...meal, id: mealRef.id }])
      setShowAddForm(false)
    } catch (error) {
      console.error('❌ Error saving meal:', error)
      alert('Failed to save meal')
    }
  }

  // ✅ Handle Search Results (Text or UPC)
  const handleSearchResults = (results?: FoodItem[]) => {
    if (!results || results.length === 0) {
      alert('No results found')
      return
    }

    if (results.length === 1) {
      setSelectedItem(results[0])
      setShowAddForm(true)
    } else {
      setSearchResults(results)
    }
  }

  // ✅ Handle Successful UPC Scan
  const handleUPCScan = async (item: { upc: string }) => {
    let upc = item.upc.trim()

    // 🔹 Fix leading zero issue if scanning a UPC-A barcode
    if (upc.length >= 12 && upc.startsWith('0')) {
      upc = upc.substring(1)
    }

    console.log('📷 Adjusted UPC:', upc)

    if (!upc) {
      alert('Invalid UPC code scanned')
      return
    }

    try {
      const res = await fetch(`/api/nutrition?upc=${upc}`)
      const data = await res.json()
      console.log(data)
      if (!data || data.length === 0) {
        alert('No results found for scanned UPC')
        return
      }

      console.log('📦 Fetched UPC Data:', data)

      if (data.length === 1) {
        setSelectedItem(data[0])
        setShowAddForm(true)
      } else {
        setSearchResults(data)
      }
    } catch (err) {
      console.error('❌ Error fetching UPC data:', err)
      alert('Failed to fetch product data.')
    } finally {
      setShowScanner(false)
    }
  }

  // ✅ Handle Scanner Errors
  const handleScannerError = (error: string) => {
    console.error('Scanner Error:', error)
    alert(error)
  }

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Diet Log</h2>

      {/* ✅ Search by Text */}
      <TextSearch onResult={handleSearchResults} />

      {/* ✅ “+” Button to Add Meal */}
      <button onClick={() => setShowAddForm(true)} className="bg-blue-500 text-white px-4 py-2 rounded my-4">
        + Add Meal
      </button>

      {/* ✅ Separate "Scan" Button */}
      <button onClick={() => setShowScanner(true)} className="bg-green-500 text-white px-4 py-2 rounded my-4">
        📷 Scan Barcode
      </button>

      {/* ✅ Show Scanner When Triggered */}
      {showScanner && <UPCScanner onScan={handleUPCScan} onClose={() => setShowScanner(false)} onError={handleScannerError} />}

      {/* ✅ Add Meal Form */}
      {showAddForm && (
        <AddMealForm
          initialData={selectedItem ?? undefined}
          onSave={handleAddMeal}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ✅ Show Logged Meals */}
      <h3 className="text-lg font-bold mt-4">Logged Meals:</h3>
      {loading ? (
        <p>Loading meals...</p>
      ) : logEntries.length === 0 ? (
        <p className="text-gray-500">No meals logged yet.</p>
      ) : (
        <ul className="space-y-4">
          {logEntries.map((entry) => (
            <li key={entry.id} className="border p-4 rounded shadow-sm">
              <h4 className="font-bold text-lg">{entry.description}</h4>
              <p className="text-gray-600">Calories: {entry.calories} kcal</p>
              <p className="text-gray-600">Protein: {entry.protein}g</p>
              <p className="text-gray-600">Fat: {entry.fat}g</p>
              <p className="text-gray-600">Carbs: {entry.carbs}g</p>
              <p className="text-gray-600">Fiber: {entry.fiber}g</p>
              <p className="text-gray-600">Sugars: {entry.sugars}g</p>
              <p className="text-gray-600">Sodium: {entry.sodium}mg</p>
              <p className="text-gray-600">Cholesterol: {entry.cholesterol}mg</p>
            </li>
          ))}
        </ul>
      )}

      {/* ✅ Dialog for Multiple Search Results */}
      {searchResults.length > 0 && (
        <ResultDialog
          results={searchResults}
          onSelect={(item) => {
            setSelectedItem(item)
            setShowAddForm(true)
            setSearchResults([])
          }}
          onClose={() => setSearchResults([])}
        />
      )}
    </div>
  )
}
