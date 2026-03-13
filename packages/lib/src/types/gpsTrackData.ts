import type { LatLng, BBox, GeoJsonFeatureCollection } from "./geoTypes"
import type { SummaryStats } from "./summaryStats"

export interface DayTrackStats {
  distance_m?: number
  elevation?: { gain?: number; loss?: number; min?: number; max?: number }
  bounds?: BBox
  [key: string]: unknown
}

export type DayEntry = {
  id: string
  name?: string
  geojson?: GeoJsonFeatureCollection
  geojsonUrl?: string
  geojsonPath?: string
  stats?: DayTrackStats
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
  combinedGeojson?: GeoJsonFeatureCollection
  combinedPath?: string
  combinedUrl?: string
  summaryStats?: SummaryStats
}
