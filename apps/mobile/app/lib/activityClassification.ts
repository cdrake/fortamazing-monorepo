// Activity type classification utilities (mirrors packages/lib/src/activityClassification.ts)

export type ActivityType =
  | "hike"
  | "walk"
  | "run"
  | "bike"
  | "climb"
  | "ski"
  | "kayak"
  | "swim"
  | "workout"
  | "other"

export type ExerciseSet = {
  reps?: number
  weight?: number
  durationSeconds?: number
  distanceMeters?: number
  notes?: string
}

export type Exercise = {
  name: string
  sets: ExerciseSet[]
  notes?: string
}

export type WorkoutData = {
  exercises: Exercise[]
  notes?: string
}

export const ACTIVITY_TYPE_ICON: Record<ActivityType, string> = {
  hike: "🥾",
  walk: "🚶",
  run: "🏃",
  bike: "🚴",
  climb: "🧗",
  ski: "⛷️",
  kayak: "🛶",
  swim: "🏊",
  workout: "🏋️",
  other: "🏔️",
}

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  hike: "Hike",
  walk: "Walk",
  run: "Run",
  bike: "Bike",
  climb: "Climb",
  ski: "Ski",
  kayak: "Kayak",
  swim: "Swim",
  workout: "Workout",
  other: "Other",
}
