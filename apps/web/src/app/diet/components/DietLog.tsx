"use client";
import { useState, useEffect, useCallback } from "react";
import { FoodItem } from "../types/FoodItem";
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

export default function DietLog() {
  const [logEntries, setLogEntries] = useState<
    Record<string, Record<string, FoodItem[]>>
  >({});

  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD")
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FoodItem | undefined>(
    undefined
  );
  const [mealTime, setMealTime] = useState("unspecified");
  const [, setLoading] = useState(true);

  const fetchMeals = useCallback(
    async (user: User | null) => {
      const mealTimes = [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "unspecified",
      ];
      if (!user) {
        setLoading(false);
        return;
      }

      const meals: Record<string, Record<string, FoodItem[]>> = {};
      meals[selectedDate] = {}; // Ensure `selectedDate` is always initialized

      for (const mealTime of mealTimes) {
        const mealsQuery = query(
          collection(
            db,
            `users/${user.uid}/dates/${selectedDate}/mealTime/${mealTime}/meals`
          )
        );
        const querySnapshot = await getDocs(mealsQuery);

        querySnapshot.docs.forEach((doc) => {
          const meal = doc.data() as FoodItem;
          const mealCategory = doc.ref.parent.id;

          if (!meals[selectedDate][mealCategory])
            meals[selectedDate][mealCategory] = [];
          meals[selectedDate][mealCategory].push(meal);
        });
      }

      setLogEntries((prev) => ({ ...prev, ...meals }));
      setLoading(false);
    },
    [selectedDate]
  );

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

  const handleAddMeal = async (meal: FoodItem) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to save meals.");
      return;
    }

    try {
      const mealId = crypto.randomUUID();
      const mealRef = doc(
        db,
        `users/${user.uid}/dates/${selectedDate}/mealTime/${mealTime}/meals/${mealId}`
      );
      await setDoc(mealRef, {
        ...meal,
        id: mealId,
        userId: user.uid,
        date: selectedDate,
        mealTime,
      });

      setLogEntries((prev) => {
        const updated = { ...prev };
        if (!updated[selectedDate]) updated[selectedDate] = {};
        if (!updated[selectedDate][mealTime]) updated[selectedDate][mealTime] = [];
        updated[selectedDate][mealTime].push({ ...meal, id: mealRef.id });
        return updated;
      });
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
    if (results.length === 1) {
      setSelectedItem(results[0]);
      setShowAddForm(true);
    } else {
      setSearchResults(results);
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
      <Calendar
        onChange={(date) =>
          setSelectedDate(dayjs(date as Date).format("YYYY-MM-DD"))
        }
        value={new Date(selectedDate)}
        className="mb-4"
      />
      <select
        value={mealTime}
        onChange={(e) => setMealTime(e.target.value)}
        className="border p-2 rounded mb-4"
      >
        <option value="unspecified">Unspecified</option>
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
        <option value="snack">Snack</option>
      </select>
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
          onSave={handleAddMeal}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      {logEntries[selectedDate] &&
      Object.keys(logEntries[selectedDate]).length > 0 ? (
        Object.entries(logEntries[selectedDate]).map(([mealTime, meals]) => (
          <DailyMealsCard
            key={mealTime}
            date={selectedDate}
            meals={Array.isArray(meals) ? meals : []}
          />
        ))
      ) : (
        <p className="text-gray-500">No meals logged for {selectedDate}.</p>
      )}
      {searchResults.length > 0 && (
        <ResultDialog
          results={searchResults}
          onSelect={(item) => {
            setSelectedItem(item);
            setShowAddForm(true);
            setSearchResults([]);
          }}
          onClose={() => setSearchResults([])}
        />
      )}
    </div>
  );
}
