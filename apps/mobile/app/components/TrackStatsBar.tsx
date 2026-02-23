// app/components/TrackStatsBar.tsx — Compact stats summary for track distance/elevation
import { View } from "react-native"

import { Text } from "@/components/Text"
import type { DayTrack } from "@/lib/trackData"

type TrackStatsBarProps = {
  dayTracks: DayTrack[]
  activeDayIndex: number | null
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

export default function TrackStatsBar({ dayTracks, activeDayIndex }: TrackStatsBarProps) {
  // Compute stats: either for active day or totals
  let distance_m = 0
  let elevMin: number | null = null
  let elevMax: number | null = null

  if (activeDayIndex !== null && dayTracks[activeDayIndex]) {
    const day = dayTracks[activeDayIndex]
    distance_m = day.stats.distance_m
    if (day.stats.elevation) {
      elevMin = day.stats.elevation.min
      elevMax = day.stats.elevation.max
    }
  } else {
    for (const day of dayTracks) {
      distance_m += day.stats.distance_m
      if (day.stats.elevation) {
        if (elevMin === null || day.stats.elevation.min < elevMin) {
          elevMin = day.stats.elevation.min
        }
        if (elevMax === null || day.stats.elevation.max > elevMax) {
          elevMax = day.stats.elevation.max
        }
      }
    }
  }

  if (distance_m === 0 && elevMin === null) return null

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "#f8f8f8",
        borderRadius: 8,
        marginTop: 4,
      }}
    >
      {distance_m > 0 && (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#888" }}>Distance</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#333" }}>
            {formatDistance(distance_m)}
          </Text>
        </View>
      )}

      {elevMin !== null && elevMax !== null && (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#888" }}>Elevation</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#333" }}>
            {Math.round(elevMin)} — {Math.round(elevMax)} m
          </Text>
        </View>
      )}
    </View>
  )
}
