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
