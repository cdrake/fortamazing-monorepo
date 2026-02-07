import { NativeModules, Platform } from "react-native"
import type { ActivityType } from "@/lib/activityClassification"

// Access the native module directly to check if it's available
// react-native-health may not work with New Architecture
const RNHealth = NativeModules.AppleHealthKit

// Import constants from the JS side (these work regardless of native module)
let HKPermissions: any = {}
let HKConstants: any = {}
try {
  const mod = require("react-native-health")
  HKPermissions = mod.Constants?.Permissions ?? mod.default?.Constants?.Permissions ?? {}
  HKConstants = mod.Constants ?? mod.default?.Constants ?? {}
} catch {
  // module not available
}

export type HealthKitWorkoutData = {
  uuid: string
  activityType: ActivityType
  startDate: string
  endDate: string
  duration: number // seconds
  distance: number | null // meters
  calories: number | null
  heartRateAvg: number | null
  sourceName: string | null
}

function mapWorkoutType(appleType: number): ActivityType {
  // Apple HKWorkoutActivityType enum values
  switch (appleType) {
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
    type: "Workout",
  }

  return new Promise((resolve) => {
    try {
      nativeModule.getSamples(options, (err: string, results: any[]) => {
        if (err || !results) {
          console.warn("HealthKit getSamples error:", err)
          resolve([])
          return
        }

        const workouts: HealthKitWorkoutData[] = results.map((w: any) => {
          const startMs = new Date(w.startDate).getTime()
          const endMs = new Date(w.endDate).getTime()

          return {
            uuid: w.id ?? w.uuid ?? `${startMs}`,
            activityType: mapWorkoutType(w.activityType ?? 0),
            startDate: w.startDate,
            endDate: w.endDate,
            duration: (endMs - startMs) / 1000,
            distance: w.distance != null ? w.distance * 1000 : null, // km → m
            calories: w.calories ?? w.activeEnergyBurned ?? null,
            heartRateAvg: null, // Would need separate HR query
            sourceName: w.sourceName ?? null,
          }
        })

        resolve(workouts)
      })
    } catch (e) {
      console.warn("HealthKit getSamples threw:", e)
      resolve([])
    }
  })
}
