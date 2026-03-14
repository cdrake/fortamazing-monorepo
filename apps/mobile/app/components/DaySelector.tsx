// app/components/DaySelector.tsx — Vertical day/track list
import { TouchableOpacity, View } from "react-native"

import { Text } from "@/components/Text"
import type { DayTrack } from "@/lib/trackData"

type DaySelectorProps = {
  dayTracks: DayTrack[]
  activeDayIndex: number | null
  onDayPress: (index: number) => void
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

function formatElevation(elev: { min: number; max: number } | null): string | null {
  if (!elev) return null
  return `${Math.round(elev.min)}–${Math.round(elev.max)} m`
}

export default function DaySelector({ dayTracks, activeDayIndex, onDayPress }: DaySelectorProps) {
  if (dayTracks.length < 2) return null

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {dayTracks.map((day, index) => {
        const isActive = activeDayIndex === index
        return (
          <TouchableOpacity
            key={day.id}
            onPress={() => onDayPress(index)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: isActive ? day.color : "#f5f3f2",
              borderLeftWidth: 4,
              borderLeftColor: day.color,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: isActive ? "#fff" : "#333",
                }}
                numberOfLines={2}
              >
                {day.name}
              </Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
                {day.stats.distance_m > 0 && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: isActive ? "rgba(255,255,255,0.8)" : "#888",
                    }}
                  >
                    {formatDistance(day.stats.distance_m)}
                  </Text>
                )}
                {formatElevation(day.stats.elevation) && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: isActive ? "rgba(255,255,255,0.8)" : "#888",
                    }}
                  >
                    ↕ {formatElevation(day.stats.elevation)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
