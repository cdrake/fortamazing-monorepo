// app/components/HikeMap.tsx — Map component for displaying hike GPS tracks
import { useEffect, useRef } from "react"
import { View, type ViewStyle } from "react-native"
import MapView, { Polyline } from "react-native-maps"

import { extractCoordinatesFromGeoJSON, type LatLng } from "@/lib/geoUtils"
import type { DayTrack } from "@/lib/trackData"

type HikeMapProps = {
  dayTracks: DayTrack[]
  activeDayIndex: number | null
  allCoordinates: LatLng[]
  onDayPress?: (index: number) => void
  style?: ViewStyle
}

const EDGE_PADDING = { top: 40, right: 40, bottom: 60, left: 40 }

export default function HikeMap({
  dayTracks,
  activeDayIndex,
  allCoordinates,
  onDayPress,
  style,
}: HikeMapProps) {
  const mapRef = useRef<MapView>(null)

  useEffect(() => {
    if (allCoordinates.length === 0 || !mapRef.current) return
    // Small delay to ensure MapView is laid out
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(allCoordinates, {
        edgePadding: EDGE_PADDING,
        animated: false,
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [allCoordinates])

  return (
    <View style={[{ height: 350, borderRadius: 12, overflow: "hidden" }, style]}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapType="standard"
        showsUserLocation={false}
        showsCompass={true}
        rotateEnabled={false}
      >
        {dayTracks.map((day, index) => {
          if (!day.visible) return null
          const coords = extractCoordinatesFromGeoJSON(day.geojson)
          if (coords.length === 0) return null

          const isActive = activeDayIndex === null || activeDayIndex === index
          return (
            <Polyline
              key={day.id}
              coordinates={coords}
              strokeColor={day.color}
              strokeWidth={isActive ? 5 : 3}
              lineCap="round"
              lineJoin="round"
              tappable={true}
              onPress={() => onDayPress?.(index)}
              style={{ opacity: isActive ? 1 : 0.4 }}
            />
          )
        })}
      </MapView>
    </View>
  )
}
