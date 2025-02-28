"use client";
import { useState, useEffect, useCallback } from "react";
import { Meal } from "../types/meal";
import TextSearch from "./Search/TextSearch";
import UPCScanner from "./Search/UPCScanner";
import ResultDialog from "./Dialogs/ResultDialog";
import AddMealForm from "./AddMealForm";
import DailyMealsCard from "./DailyMealsCard";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  db,
  auth,
  collection,
  setDoc,
  getDocs,
  query,
  doc,
} from "../../../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import dayjs from "dayjs";
import { FoodItem } from "../types/FoodItem";

export default function DietLog() {
  const [logEntries, setLogEntries] = useState<Record<string, Meal[]>>({});
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchResults, setSearchResults] = useState<Meal[]>([]);
  const [selectedItem, setSelectedItem] = useState<Meal | undefined>(undefined);
  const [, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  // ✅ Fetch all meals for the selected date
  const fetchMeals = useCallback(async (user: User | null) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const mealsQuery = query(collection(db, `users/${user.uid}/dates/${selectedDate}/meals`));
    const querySnapshot = await getDocs(mealsQuery);

    const meals: Meal[] = querySnapshot.docs.map((doc) => doc.data() as Meal);

    setLogEntries((prev) => ({
      ...prev,
      [selectedDate]: meals, // ✅ Store meals by date only
    }));

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchMeals(user);
      else {
        setLogEntries({});
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchMeals]);

  // ✅ Save Meal to Firestore
  const handleAddMeal = async (meal: Meal) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to save meals.");
      return;
    }

    try {
      const mealId = crypto.randomUUID();
      const mealRef = doc(db, `users/${user.uid}/dates/${selectedDate}/meals/${mealId}`);

      await setDoc(mealRef, {
        ...meal,
        id: mealId,
        userId: user.uid,
        date: selectedDate,
      });

      setLogEntries((prev) => ({
        ...prev,
        [selectedDate]: [...(prev[selectedDate] || []), { ...meal, id: mealRef.id }],
      }));

      setShowAddForm(false);
    } catch (error) {
      console.error("❌ Error saving meal:", error);
      alert("Failed to save meal");
    }
  };

  const handleSearchResults = (results?: FoodItem[]) => {
    if (!results || results.length === 0) {
      alert("No results found");
      return;
    }
  
    const meals: Meal[] = results.map((foodItem) => ({
      ...foodItem,
      mealTime: "unspecified", // Default meal time
    }));
  
    if (meals.length === 1) {
      setSelectedItem(meals[0]);
      setShowAddForm(true);
    } else {
      setSearchResults(meals);
    }
  };

  const handleUPCScan = async (item: { upc: string }) => {
    let upc = item.upc.trim();
    if (upc.length >= 12 && upc.startsWith("0")) {
      upc = upc.substring(1);
    }
    if (!upc) {
      alert("Invalid UPC code scanned");
      return;
    }
    try {
      const res = await fetch(`/api/nutrition?upc=${upc}`);
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("No results found for scanned UPC");
        return;
      }
      if (data.length === 1) {
        setSelectedItem(data[0]);
        setShowAddForm(true);
      } else {
        setSearchResults(data);
      }
    } catch (err) {
      console.error("❌ Error fetching UPC data:", err);
      alert("Failed to fetch product data.");
    } finally {
      setShowScanner(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Diet Log</h2>
      <button
        onClick={() => setShowCalendar(!showCalendar)}
        className="bg-blue-500 text-white px-3 py-1 rounded mb-4"
      >
        📅 Change Date
      </button>
      {showCalendar && (
        <Calendar
          onChange={(date) =>
            setSelectedDate(dayjs(date as Date).format("YYYY-MM-DD"))
          }
          value={new Date(selectedDate)}
          className="mb-4"
        />
      )}
      <TextSearch onResult={handleSearchResults} />
      <button
        onClick={() => setShowAddForm(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded my-4"
      >
        + Add Meal
      </button>
      <button
        onClick={() => setShowScanner(true)}
        className="bg-green-500 text-white px-4 py-2 rounded my-4"
      >
        📷 Scan Barcode
      </button>
      {showScanner && (
        <UPCScanner
          onScan={handleUPCScan}
          onClose={() => setShowScanner(false)}
        />
      )}
      {showAddForm && (
        <AddMealForm
          initialData={selectedItem ?? undefined}
          onSave={(meal) => handleAddMeal(meal)}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      {logEntries[selectedDate] ? (
        <DailyMealsCard
          date={selectedDate}
          meals={logEntries[selectedDate] || []} // ✅ Pass meals directly
        />
      ) : (
        <p className="text-gray-500">No meals logged for {selectedDate}.</p>
      )}
      {searchResults.length > 0 && (
        <ResultDialog
        results={searchResults}
        onSelect={(item) => {
          setSelectedItem({
            ...item,
            mealTime: "unspecified", // ✅ Ensure mealTime exists
          });
          setShowAddForm(true);
          setSearchResults([]);
        }}
        onClose={() => setSearchResults([])}
      />
      )}
    </div>
  );
}
