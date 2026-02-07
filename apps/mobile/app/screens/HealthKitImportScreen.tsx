import React, { useCallback, useEffect, useState } from "react"
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL } from "@/lib/activityClassification"
import {
  requestPermissions,
  fetchRecentWorkouts,
  type HealthKitWorkoutData,
} from "@/lib/healthKit"
import { createActivity, listActivities } from "@/lib/activities"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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

export const HealthKitImportScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets()
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

    const ok = await requestPermissions()
    if (!ok) {
      Alert.alert(
        "HealthKit Unavailable",
        "Could not access Apple Health. Please enable HealthKit permissions in Settings.",
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
    setLoading(false)
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
        style={[styles.row, alreadyImported && styles.rowImported]}
        onPress={() => !alreadyImported && toggleSelect(item.uuid)}
        disabled={alreadyImported}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
          {alreadyImported && <Text style={styles.checkmark}>—</Text>}
        </View>
        <Text style={styles.rowIcon}>{ACTIVITY_TYPE_ICON[item.activityType]}</Text>
        <View style={styles.rowContent}>
          <Text weight="medium">
            {ACTIVITY_TYPE_LABEL[item.activityType]}
          </Text>
          <Text size="xs" style={{ color: "#888" }}>
            {formatDate(item.startDate)} · {formatDuration(item.duration)}
            {item.distance ? ` · ${formatDistance(item.distance)}` : ""}
          </Text>
          {alreadyImported && (
            <Text size="xs" style={{ color: "#aaa" }}>
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
        <Text size="sm" style={{ color: "#888" }}>
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
              <Text style={{ padding: 20, color: "#888" }}>
                No workouts found in the last 30 days.
              </Text>
            }
          />

          {selected.size > 0 && (
            <View style={[styles.importBar, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[styles.importBtn, importing && { opacity: 0.6 }]}
                onPress={handleImport}
                disabled={importing}
                activeOpacity={0.8}
              >
                {importing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.importBtnText} weight="bold">
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: {
    paddingVertical: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  rowImported: {
    opacity: 0.5,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#4A90D9",
    borderColor: "#4A90D9",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  importBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  importBtn: {
    backgroundColor: "#4A90D9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  importBtnText: {
    color: "#fff",
    fontSize: 16,
  },
})

export default HealthKitImportScreen
