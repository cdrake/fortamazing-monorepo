import { NativeModules, Platform } from "react-native"

import type { ActivityType } from "@/lib/activityClassification"

// Access the native module directly to check if it's available
const RNHealth = NativeModules.AppleHealthKit

// Import constants from the JS side (these work regardless of native module)
let HKPermissions: any = {}
try {
  const mod = require("react-native-health")
  HKPermissions = mod.Constants?.Permissions ?? mod.default?.Constants?.Permissions ?? {}
} catch {
  // module not available
}

export type HealthKitWorkoutData = {
  uuid: string
  activityType: ActivityType
  activityName: string
  startDate: string
  endDate: string
  duration: number // seconds
  distance: number | null // meters
  calories: number | null
  heartRateAvg: number | null
  sourceName: string | null
}

const MILES_TO_METERS = 1609.344

function mapWorkoutType(activityId: number): ActivityType {
  // Apple HKWorkoutActivityType enum values
  switch (activityId) {
    case 37: // running
      return "run"
    case 52: // walking
      return "walk"
    case 13: // cycling
      return "bike"
    case 46: // swimming
      return "swim"
    case 24: // hiking
      return "hike"
    case 20: // functionalStrengthTraining
    case 50: // traditionalStrengthTraining
      return "workout"
    case 60: // crossCountrySkiing
    case 14: // downhillSkiing
      return "ski"
    case 30: // paddleSports
      return "kayak"
    case 12: // climbing
      return "climb"
    default:
      return "other"
  }
}

function getNativeModule() {
  if (!RNHealth) {
    throw new Error(
      "HealthKit native module is not available. This may be a New Architecture compatibility issue with react-native-health.",
    )
  }
  return RNHealth
}

export function isAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !RNHealth) return Promise.resolve(false)

  return new Promise((resolve) => {
    try {
      RNHealth.isAvailable((err: any, available: boolean) => {
        if (err) {
          console.warn("HealthKit availability check error:", err)
          resolve(false)
          return
        }
        resolve(available)
      })
    } catch (e) {
      console.warn("HealthKit isAvailable threw:", e)
      resolve(false)
    }
  })
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== "ios") return false

  const nativeModule = getNativeModule()

  const available = await isAvailable()
  if (!available) {
    console.warn("HealthKit is not available on this device")
    return false
  }

  const permissions = {
    permissions: {
      read: [
        HKPermissions.Workout,
        HKPermissions.HeartRate,
        HKPermissions.ActiveEnergyBurned,
      ].filter(Boolean),
      write: [] as string[],
    },
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("HealthKit initHealthKit timed out after 10s")
      resolve(false)
    }, 10_000)

    try {
      nativeModule.initHealthKit(permissions, (err: any) => {
        clearTimeout(timeout)
        if (err) {
          console.warn("HealthKit init error:", err)
          resolve(false)
          return
        }
        resolve(true)
      })
    } catch (e) {
      clearTimeout(timeout)
      console.warn("HealthKit initHealthKit threw:", e)
      resolve(false)
    }
  })
}

export async function fetchRecentWorkouts(days = 30): Promise<HealthKitWorkoutData[]> {
  if (Platform.OS !== "ios") return []

  const nativeModule = getNativeModule()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const options = {
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
  }

  return new Promise((resolve) => {
    try {
      // getAnchoredWorkouts returns { anchor: string, data: WorkoutItem[] }
      // Each WorkoutItem has: activityId, id, activityName, calories, distance (miles),
      //   start (ISO), end (ISO), duration (seconds), sourceName, etc.
      nativeModule.getAnchoredWorkouts(options, (err: any, result: any) => {
        if (err || !result) {
          console.warn("HealthKit getAnchoredWorkouts error:", err)
          resolve([])
          return
        }

        const items = result.data ?? result
        if (!Array.isArray(items)) {
          console.warn("HealthKit: unexpected result shape:", typeof result)
          resolve([])
          return
        }

        const workouts: HealthKitWorkoutData[] = items.map((w: any) => ({
          uuid: w.id ?? `${new Date(w.start).getTime()}`,
          activityType: mapWorkoutType(w.activityId ?? 0),
          activityName: w.activityName ?? "Workout",
          startDate: w.start,
          endDate: w.end,
          duration: w.duration ?? 0,
          distance: w.distance != null ? w.distance * MILES_TO_METERS : null,
          calories: w.calories ?? null,
          heartRateAvg: null,
          sourceName: w.sourceName ?? null,
        }))

        resolve(workouts)
      })
    } catch (e) {
      console.warn("HealthKit getAnchoredWorkouts threw:", e)
      resolve([])
    }
  })
}
