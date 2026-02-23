import { db } from "@/lib/firebase"
import { collection, getDocs, query } from "firebase/firestore"

export type DietRangeSummary = {
  dayCount: number
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  avgDailyCalories: number
}

function dateToKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function datesInRange(start: Date, end: Date): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(23, 59, 59, 999)
  while (cur <= endNorm) {
    dates.push(dateToKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function fetchMealsForDateRange(
  uid: string,
  startDate: Date,
  endDate: Date,
): Promise<DietRangeSummary> {
  const keys = datesInRange(startDate, endDate)
  let totalCalories = 0
  let totalProtein = 0
  let totalFat = 0
  let totalCarbs = 0
  let daysWithMeals = 0

  await Promise.all(
    keys.map(async (dateKey) => {
      const mealsRef = collection(db, `users/${uid}/dates/${dateKey}/meals`)
      const snap = await getDocs(query(mealsRef))
      if (snap.empty) return

      daysWithMeals++
      snap.docs.forEach((d) => {
        const data = d.data()
        totalCalories += Number(data.calories) || 0
        totalProtein += Number(data.protein) || 0
        totalFat += Number(data.fat) || 0
        totalCarbs += Number(data.carbs) || 0
      })
    }),
  )

  return {
    dayCount: daysWithMeals,
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein),
    totalFat: Math.round(totalFat),
    totalCarbs: Math.round(totalCarbs),
    avgDailyCalories: daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0,
  }
}
