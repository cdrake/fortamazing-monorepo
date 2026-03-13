import { useCallback, useEffect, useState } from "react"
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { createActivity, listActivities } from "@/lib/activities"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL } from "@/lib/activityClassification"
import {
  isAvailable,
  requestPermissions,
  fetchRecentWorkouts,
  type HealthKitWorkoutData,
} from "@/lib/healthKit"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"

type Props = AppStackScreenProps<"HealthKitImport">

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDistance(meters: number | null): string {
  if (meters == null || meters === 0) return ""
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export const HealthKitImportScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets()
  const {
    theme: { colors },
  } = useAppTheme()
  const [workouts, setWorkouts] = useState<HealthKitWorkoutData[]>([])
  const [importedUuids, setImportedUuids] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    void loadWorkouts()
  }, [])

  const loadWorkouts = async () => {
    setLoading(true)

    try {
      const available = await isAvailable()
      if (!available) {
        Alert.alert("HealthKit Unavailable", "Apple Health is not available on this device.")
        setLoading(false)
        return
      }

      const ok = await requestPermissions()
      if (!ok) {
        Alert.alert(
          "Permission Denied",
          "Could not access Apple Health. Please enable HealthKit permissions in Settings > Health > Data Access & Devices > FortAmazing.",
        )
        setLoading(false)
        return
      }

      // Fetch workouts + already-imported UUIDs in parallel
      const [wk, existing] = await Promise.all([fetchRecentWorkouts(30), listActivities()])

      const imported = new Set<string>()
      for (const act of existing) {
        const hk = (act as any).healthKit
        if (hk?.uuid) imported.add(hk.uuid)
      }

      setImportedUuids(imported)
      setWorkouts(wk)
    } catch (err: any) {
      console.warn("HealthKit load error:", err)
      Alert.alert("Error", err?.message ?? "Failed to load workouts from Apple Health.")
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return

    setImporting(true)
    try {
      const toImport = workouts.filter((w) => selected.has(w.uuid))
      for (const w of toImport) {
        const dateStr = new Date(w.startDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        await createActivity({
          type: w.activityType,
          title: `${ACTIVITY_TYPE_LABEL[w.activityType]} — ${dateStr}`,
          privacy: "private",
          healthKit: {
            uuid: w.uuid,
            duration: w.duration,
            calories: w.calories,
            distance: w.distance,
            heartRateAvg: w.heartRateAvg,
            sourceName: w.sourceName,
            startDate: w.startDate,
            endDate: w.endDate,
          },
          distance: w.distance,
          duration: w.duration,
        })
      }
      Alert.alert("Imported", `${toImport.length} workout(s) imported successfully.`)
      navigation.popToTop()
    } catch (err: any) {
      Alert.alert("Import Failed", err?.message ?? "Unknown error")
    } finally {
      setImporting(false)
    }
  }, [selected, workouts, navigation])

  const renderItem = ({ item }: { item: HealthKitWorkoutData }) => {
    const alreadyImported = importedUuids.has(item.uuid)
    const isSelected = selected.has(item.uuid)

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { borderBottomColor: colors.palette.neutral200 },
          alreadyImported && styles.rowImported,
        ]}
        onPress={() => !alreadyImported && toggleSelect(item.uuid)}
        disabled={alreadyImported}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            isSelected && { backgroundColor: colors.tint, borderColor: colors.tint },
          ]}
        >
          {isSelected && (
            <Text style={[styles.checkmark, { color: colors.palette.neutral100 }]}>✓</Text>
          )}
          {alreadyImported && (
            <Text style={[styles.checkmark, { color: colors.palette.neutral100 }]}>—</Text>
          )}
        </View>
        <Text style={styles.rowIcon}>{ACTIVITY_TYPE_ICON[item.activityType]}</Text>
        <View style={styles.rowContent}>
          <Text weight="medium">{ACTIVITY_TYPE_LABEL[item.activityType]}</Text>
          <Text size="xs" style={{ color: colors.textDim }}>
            {formatDate(item.startDate)} · {formatDuration(item.duration)}
            {item.distance ? ` · ${formatDistance(item.distance)}` : ""}
          </Text>
          {alreadyImported && (
            <Text size="xs" style={{ color: colors.tintInactive }}>
              Already imported
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Screen preset="fixed">
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="lg">{Platform.OS === "ios" ? "‹ Back" : "← Back"}</Text>
        </TouchableOpacity>
        <Text size="xl" weight="bold">
          Import from Apple Health
        </Text>
        <Text size="sm" style={{ color: colors.textDim }}>
          Last 30 days
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>Loading workouts...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={workouts}
            keyExtractor={(w) => w.uuid}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={{ padding: 20, color: colors.textDim }}>
                No workouts found in the last 30 days.
              </Text>
            }
          />

          {selected.size > 0 && (
            <View
              style={[
                styles.importBar,
                {
                  backgroundColor: colors.palette.neutral100,
                  borderTopColor: colors.separator,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.importBtn,
                  { backgroundColor: colors.tint },
                  importing && { opacity: 0.6 },
                ]}
                onPress={handleImport}
                disabled={importing}
                activeOpacity={0.8}
              >
                {importing ? (
                  <ActivityIndicator color={colors.palette.neutral100} />
                ) : (
                  <Text style={{ color: colors.palette.neutral100, fontSize: 16 }} weight="bold">
                    Import {selected.size} Workout{selected.size !== 1 ? "s" : ""}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  backBtn: {
    paddingVertical: 4,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  checkbox: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: "bold",
  },
  header: {
    gap: 4,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  importBar: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
  importBtn: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 16,
  },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowImported: {
    opacity: 0.5,
  },
})

export default HealthKitImportScreen
