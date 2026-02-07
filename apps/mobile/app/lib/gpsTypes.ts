import type { FeatureCollection, LineString } from "geojson"

export type GpsPoint = {
  latitude: number
  longitude: number
  altitude: number | null
  timestamp: number
  speed: number | null
  accuracy: number | null
}

export type RecordingState = {
  isRecording: boolean
  startedAt: number | null
  points: GpsPoint[]
  totalDistance: number
}

export type GpsTrackResult = {
  geojson: FeatureCollection<LineString>
  distance: number
  duration: number
  elevationGain: number | null
  elevationLoss: number | null
  startedAt: number
  endedAt: number
}
