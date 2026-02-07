// app/components/DaySelector.tsx — Horizontal day picker for multi-day hikes
import React from "react"
import { ScrollView, TouchableOpacity, Text, View } from "react-native"

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

export default function DaySelector({ dayTracks, activeDayIndex, onDayPress }: DaySelectorProps) {
  if (dayTracks.length < 2) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
    >
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
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? day.color : "#f0f0f0",
              borderWidth: 2,
              borderColor: day.color,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isActive ? "#fff" : day.color,
                marginRight: 6,
              }}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: isActive ? "#fff" : "#333",
              }}
            >
              {day.name}
            </Text>
            {day.stats.distance_m > 0 && (
              <Text
                style={{
                  fontSize: 11,
                  color: isActive ? "rgba(255,255,255,0.8)" : "#888",
                  marginLeft: 6,
                }}
              >
                {formatDistance(day.stats.distance_m)}
              </Text>
            )}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
