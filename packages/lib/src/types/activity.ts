import type { ActivityType } from "./activityType"
import type { ActivityPhoto } from "./activityPhoto"
import type { GpsTrackData, DayEntry } from "./gpsTrackData"
import type { WorkoutData } from "./workoutData"
import type { Difficulty } from "./difficulty"
import type { Privacy } from "./privacy"
import type { LatLng, BBox, GeoJsonFeatureCollection } from "./geoTypes"
import type { SummaryStats } from "./summaryStats"

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
  days?: DayEntry[]
  images?: ActivityPhoto[]
  combinedPath?: string
  combinedUrl?: string
  combinedGeojson?: GeoJsonFeatureCollection
  bounds?: BBox
  geohash?: string
  encodedPolyline?: string
  distanceMeters?: number
  movingTimeSeconds?: number
  elevationGainMeters?: number
  startLocation?: LatLng
  endLocation?: LatLng
  bbox?: BBox
  trackStoragePath?: string
  elevationHistogram?: number[]
  summaryStats?: SummaryStats
}
