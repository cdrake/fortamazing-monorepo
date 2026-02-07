import type { ActivityType } from "./types/activityType"

export type ActivityCategory = "gps" | "workout"

export function getActivityCategory(type: ActivityType): ActivityCategory {
  return type === "workout" ? "workout" : "gps"
}

export function isGpsActivity(type: ActivityType): boolean {
  return getActivityCategory(type) === "gps"
}

export function isWorkoutActivity(type: ActivityType): boolean {
  return type === "workout"
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
