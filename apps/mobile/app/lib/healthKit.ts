import AppleHealthKit, {
  HealthKitPermissions,
  HealthInputOptions,
  HealthObserver,
  HealthValue,
} from "react-native-health"
import { Platform } from "react-native"
import type { ActivityType } from "@/lib/activityClassification"

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

const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
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

export function isAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.isAvailable((err, available) => {
      if (err) {
        console.warn("HealthKit availability check error:", err)
        resolve(false)
        return
      }
      resolve(available)
    })
  })
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== "ios") return false

  const available = await isAvailable()
  if (!available) {
    console.warn("HealthKit is not available on this device")
    return false
  }

  return new Promise((resolve) => {
    // Timeout in case initHealthKit never calls back
    const timeout = setTimeout(() => {
      console.warn("HealthKit initHealthKit timed out after 10s")
      resolve(false)
    }, 10_000)

    AppleHealthKit.initHealthKit(permissions, (err) => {
      clearTimeout(timeout)
      if (err) {
        console.warn("HealthKit init error:", err)
        resolve(false)
        return
      }
      resolve(true)
    })
  })
}

export async function fetchRecentWorkouts(days = 30): Promise<HealthKitWorkoutData[]> {
  if (Platform.OS !== "ios") return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const options: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
    type: HealthObserver.Workout,
  }

  return new Promise((resolve) => {
    AppleHealthKit.getSamples(options, (err: string, results: HealthValue[]) => {
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
  })
}
