import type { LatLng, BBox } from "./geoTypes"
import type { SummaryStats } from "./summaryStats"

export type DayEntry = {
  id: string
  name?: string
  geojson?: unknown
  geojsonUrl?: string
  geojsonPath?: string
  stats?: Record<string, unknown>
  color?: string | null
  visible?: boolean
}

export type GpsTrackData = {
  distanceMeters?: number
  movingTimeSeconds?: number
  elevationGainMeters?: number
  elevationLossMeters?: number
  startLocation?: LatLng
  endLocation?: LatLng
  bbox?: BBox
  geohash?: string
  encodedPolyline?: string
  polylineSimplifiedResolution?: number
  trackStoragePath?: string
  elevationHistogram?: number[]
  days?: DayEntry[]
  combinedGeojson?: unknown
  combinedPath?: string
  combinedUrl?: string
  summaryStats?: SummaryStats
}
