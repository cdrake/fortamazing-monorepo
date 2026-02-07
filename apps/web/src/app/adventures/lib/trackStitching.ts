import type { LatLng } from "@fortamazing/lib/types/geoTypes"
import type { Feature, LineString } from "geojson"

export type TravelSegment = {
  from: LatLng
  to: LatLng
  distanceMeters: number
  kind: "continuous" | "travel"
}

const DEG_TO_RAD = Math.PI / 180
const EARTH_RADIUS_M = 6_371_000

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.latitude - a.latitude) * DEG_TO_RAD
  const dLon = (b.longitude - a.longitude) * DEG_TO_RAD
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos(a.latitude * DEG_TO_RAD) *
      Math.cos(b.latitude * DEG_TO_RAD) *
      sinLon * sinLon
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

type ActivityLike = {
  track?: {
    startLocation?: LatLng
    endLocation?: LatLng
  }
  [key: string]: unknown
}

export function computeTravelSegments(
  activities: ActivityLike[],
  thresholdMeters = 750,
): TravelSegment[] {
  const segments: TravelSegment[] = []
  for (let i = 0; i < activities.length - 1; i++) {
    const endLoc = activities[i].track?.endLocation
    const startLoc = activities[i + 1].track?.startLocation
    if (!endLoc || !startLoc) continue

    const dist = haversineDistance(endLoc, startLoc)
    segments.push({
      from: endLoc,
      to: startLoc,
      distanceMeters: dist,
      kind: dist <= thresholdMeters ? "continuous" : "travel",
    })
  }
  return segments
}

export function travelSegmentToGeoJSON(seg: TravelSegment): Feature<LineString> {
  const isContinuous = seg.kind === "continuous"
  return {
    type: "Feature",
    properties: {
      color: isContinuous ? "#3388ff" : "#999999",
      weight: isContinuous ? 3 : 2,
      opacity: isContinuous ? 0.7 : 0.5,
      dashArray: isContinuous ? undefined : "6 8",
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [seg.from.longitude, seg.from.latitude],
        [seg.to.longitude, seg.to.latitude],
      ],
    },
  }
}
