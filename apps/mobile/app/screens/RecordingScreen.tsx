import { type FC, useCallback, useState } from "react"
import { View, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native"
import MapView, { Polyline } from "react-native-maps"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useGpsRecording } from "@/hooks/useGpsRecording"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL } from "@/lib/activityClassification"
import { computeBoundsRegion } from "@/lib/geoUtils"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"

type Props = AppStackScreenProps<"Recording">

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

function formatPace(meters: number, secs: number): string {
  if (meters < 10 || secs < 1) return "--:--"
  const minPerKm = secs / 60 / (meters / 1000)
  const whole = Math.floor(minPerKm)
  const frac = Math.round((minPerKm - whole) * 60)
  return `${whole}:${String(frac).padStart(2, "0")} /km`
}

export const RecordingScreen: FC<Props> = ({ route, navigation }) => {
  const { type } = route.params
  const insets = useSafeAreaInsets()
  const {
    theme: { colors },
  } = useAppTheme()
  const { isRecording, points, elapsed, distance, currentLocation, start, stop, discard } =
    useGpsRecording()
  const [started, setStarted] = useState(false)

  const handleStart = useCallback(async () => {
    const ok = await start()
    if (!ok) {
      Alert.alert("Permission Denied", "Location permissions are required to record an activity.")
      return
    }
    setStarted(true)
  }, [start])

  const handleStop = useCallback(() => {
    Alert.alert("Stop Recording?", "This will finish recording and let you save the activity.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          const trackData = await stop()
          if (trackData) {
            navigation.replace("SaveActivity", { type, trackData })
          } else {
            Alert.alert("No Data", "Not enough GPS points were recorded. Try again.")
            navigation.goBack()
          }
        },
      },
    ])
  }, [stop, navigation, type])

  const handleDiscard = useCallback(() => {
    Alert.alert("Discard Recording?", "All recorded GPS data will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await discard()
          navigation.goBack()
        },
      },
    ])
  }, [discard, navigation])

  const coords = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
  const region = computeBoundsRegion(coords) ?? {
    latitude: currentLocation?.latitude ?? 37.78,
    longitude: currentLocation?.longitude ?? -122.43,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }

  const showPace = type === "run" || type === "walk"

  return (
    <Screen preset="fixed">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.typeIcon}>{ACTIVITY_TYPE_ICON[type]}</Text>
        <Text size="lg" weight="bold">
          {ACTIVITY_TYPE_LABEL[type]}
        </Text>
      </View>

      <MapView style={styles.map} region={region} showsUserLocation>
        {coords.length >= 2 && (
          <Polyline coordinates={coords} strokeColor={colors.tint} strokeWidth={3} />
        )}
      </MapView>

      <View style={[styles.stats, { backgroundColor: colors.palette.neutral100 }]}>
        <View style={styles.statItem}>
          <Text size="xxs" weight="medium" style={{ color: colors.textDim, marginBottom: 2 }}>
            TIME
          </Text>
          <Text size="xl" weight="bold">
            {formatElapsed(elapsed)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text size="xxs" weight="medium" style={{ color: colors.textDim, marginBottom: 2 }}>
            DISTANCE
          </Text>
          <Text size="xl" weight="bold">
            {formatDistance(distance)}
          </Text>
        </View>
        {showPace && (
          <View style={styles.statItem}>
            <Text size="xxs" weight="medium" style={{ color: colors.textDim, marginBottom: 2 }}>
              PACE
            </Text>
            <Text size="xl" weight="bold">
              {formatPace(distance, elapsed)}
            </Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.controls,
          { backgroundColor: colors.palette.neutral100, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {!started || !isRecording ? (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: "#4CAF50" }]}
            onPress={handleStart}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.palette.neutral100, fontSize: 18 }} weight="bold">
              {Platform.OS === "ios" ? "▶ Start" : "Start"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.discardBtn, { backgroundColor: colors.palette.neutral200 }]}
              onPress={handleDiscard}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.textDim, fontSize: 18 }} weight="bold">
                Discard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stopBtn, { backgroundColor: colors.error }]}
              onPress={handleStop}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.palette.neutral100, fontSize: 18 }} weight="bold">
                Stop
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  controlRow: {
    flexDirection: "row",
    gap: 12,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  discardBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  map: {
    flex: 1,
  },
  startBtn: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: "center",
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  stopBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 16,
  },
  typeIcon: {
    fontSize: 24,
  },
})

export default RecordingScreen
