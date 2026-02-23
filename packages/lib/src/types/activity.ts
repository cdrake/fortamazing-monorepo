import type { ActivityType } from "./activityType"
import type { ActivityPhoto } from "./activityPhoto"
import type { GpsTrackData } from "./gpsTrackData"
import type { WorkoutData } from "./workoutData"
import type { Difficulty } from "./difficulty"
import type { Privacy } from "./privacy"

export type Activity = {
  ownerId: string
  type: ActivityType

  title: string
  description?: string

  createdAt: string
  updatedAt: string

  startTime?: string
  endTime?: string
  durationSeconds?: number

  difficulty?: Difficulty
  privacy: Privacy

  tags?: string[]
  friends?: string[]

  photoCount?: number
  photos?: ActivityPhoto[]

  adventureId?: string

  track?: GpsTrackData
  workout?: WorkoutData

  // Backward-compat fields (match existing hike doc shape for migration period)
  public?: boolean
  owner?: { uid: string }
  descriptionMd?: string
  days?: unknown[]
  images?: ActivityPhoto[]
  combinedPath?: string
  combinedUrl?: string
  combinedGeojson?: unknown
  bounds?: unknown
  geohash?: string
  encodedPolyline?: string
  distanceMeters?: number
  movingTimeSeconds?: number
  elevationGainMeters?: number
  startLocation?: unknown
  endLocation?: unknown
  bbox?: unknown
  trackStoragePath?: string
  elevationHistogram?: number[]
  summaryStats?: unknown
}
