// Re-export activity classification utilities from shared lib
// Using direct relative path to avoid pulling in react-native via barrel export
export {
  getActivityCategory,
  isGpsActivity,
  isWorkoutActivity,
  ACTIVITY_TYPE_ICON,
  ACTIVITY_TYPE_LABEL,
} from "../../../../packages/lib/src/activityClassification"
export type { ActivityCategory } from "../../../../packages/lib/src/activityClassification"
