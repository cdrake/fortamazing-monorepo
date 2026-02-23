import React, { useCallback, useState } from "react"
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import {
  ACTIVITY_TYPE_ICON,
  ACTIVITY_TYPE_LABEL,
  type ActivityType,
  type Exercise,
  type ExerciseSet,
  type WorkoutData,
} from "@/lib/activityClassification"
import { createActivity } from "@/lib/activities"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = AppStackScreenProps<"SaveActivity">

type PrivacyOption = "private" | "public" | "friends"

function generateTitle(type: ActivityType): string {
  const now = new Date()
  const hour = now.getHours()
  let timeOfDay = "Morning"
  if (hour >= 12 && hour < 17) timeOfDay = "Afternoon"
  else if (hour >= 17) timeOfDay = "Evening"

  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${timeOfDay} ${ACTIVITY_TYPE_LABEL[type]} — ${dateStr}`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const SaveActivityScreen: React.FC<Props> = ({ route, navigation }) => {
  const { type, trackData, healthKitWorkout } = route.params
  const insets = useSafeAreaInsets()

  const [title, setTitle] = useState(generateTitle(type))
  const [privacy, setPrivacy] = useState<PrivacyOption>("private")
  const [saving, setSaving] = useState(false)

  // Workout manual entry state
  const isManualWorkout = type === "workout" && !healthKitWorkout
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workoutNotes, setWorkoutNotes] = useState("")

  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: [{ reps: undefined, weight: undefined }] }])
  }

  const updateExerciseName = (idx: number, name: string) => {
    const next = [...exercises]
    next[idx] = { ...next[idx], name }
    setExercises(next)
  }

  const addSet = (exIdx: number) => {
    const next = [...exercises]
    next[exIdx] = {
      ...next[exIdx],
      sets: [...next[exIdx].sets, { reps: undefined, weight: undefined }],
    }
    setExercises(next)
  }

  const updateSet = (exIdx: number, setIdx: number, field: keyof ExerciseSet, value: string) => {
    const next = [...exercises]
    const numVal = value === "" ? undefined : Number(value)
    next[exIdx] = {
      ...next[exIdx],
      sets: next[exIdx].sets.map((s, i) => (i === setIdx ? { ...s, [field]: numVal } : s)),
    }
    setExercises(next)
  }

  const removeExercise = (idx: number) => {
    setExercises(exercises.filter((_, i) => i !== idx))
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a title for your activity.")
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        type,
        title: title.trim(),
        privacy,
      }

      if (trackData) {
        payload.track = {
          geojson: trackData.geojson,
          distance: trackData.distance,
          duration: trackData.duration,
          elevationGain: trackData.elevationGain,
          elevationLoss: trackData.elevationLoss,
        }
        // Backward-compat flat fields
        payload.distance = trackData.distance
        payload.duration = trackData.duration
      }

      if (healthKitWorkout) {
        payload.healthKit = {
          uuid: healthKitWorkout.uuid,
          duration: healthKitWorkout.duration,
          calories: healthKitWorkout.calories,
          distance: healthKitWorkout.distance,
          heartRateAvg: healthKitWorkout.heartRateAvg,
        }
        if (healthKitWorkout.distance) payload.distance = healthKitWorkout.distance
        if (healthKitWorkout.duration) payload.duration = healthKitWorkout.duration
      }

      if (isManualWorkout && exercises.length > 0) {
        const workout: WorkoutData = {
          exercises: exercises.filter((e) => e.name.trim()),
          notes: workoutNotes.trim() || undefined,
        }
        payload.workout = workout
      }

      await createActivity(payload)
      navigation.popToTop()
    } catch (err: any) {
      Alert.alert("Save Failed", err?.message ?? "Unknown error")
    } finally {
      setSaving(false)
    }
  }, [title, type, privacy, trackData, healthKitWorkout, exercises, workoutNotes, isManualWorkout, navigation])

  const privacyOptions: PrivacyOption[] = ["private", "public", "friends"]

  return (
    <Screen preset="fixed">
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="lg">{Platform.OS === "ios" ? "‹ Back" : "← Back"}</Text>
          </TouchableOpacity>
          <Text size="xl" weight="bold">
            Save Activity
          </Text>
        </View>

        {/* Type indicator */}
        <View style={styles.typeRow}>
          <Text style={styles.typeIcon}>{ACTIVITY_TYPE_ICON[type]}</Text>
          <Text weight="medium">{ACTIVITY_TYPE_LABEL[type]}</Text>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text size="xs" weight="medium" style={styles.label}>
            TITLE
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Activity title"
          />
        </View>

        {/* Privacy */}
        <View style={styles.field}>
          <Text size="xs" weight="medium" style={styles.label}>
            PRIVACY
          </Text>
          <View style={styles.privacyRow}>
            {privacyOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.privacyBtn, privacy === opt && styles.privacyBtnActive]}
                onPress={() => setPrivacy(opt)}
              >
                <Text
                  size="sm"
                  weight={privacy === opt ? "bold" : "normal"}
                  style={privacy === opt ? styles.privacyTextActive : undefined}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Track summary */}
        {trackData && (
          <View style={styles.summaryCard}>
            <Text size="xs" weight="medium" style={styles.label}>
              TRACK SUMMARY
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text size="sm" style={styles.summaryLabel}>
                  Distance
                </Text>
                <Text weight="bold">{formatDistance(trackData.distance)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text size="sm" style={styles.summaryLabel}>
                  Duration
                </Text>
                <Text weight="bold">{formatDuration(trackData.duration)}</Text>
              </View>
              {trackData.elevationGain != null && (
                <View style={styles.summaryItem}>
                  <Text size="sm" style={styles.summaryLabel}>
                    Elevation
                  </Text>
                  <Text weight="bold">↑{Math.round(trackData.elevationGain)}m</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* HealthKit workout summary */}
        {healthKitWorkout && (
          <View style={styles.summaryCard}>
            <Text size="xs" weight="medium" style={styles.label}>
              WORKOUT SUMMARY
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text size="sm" style={styles.summaryLabel}>
                  Duration
                </Text>
                <Text weight="bold">{formatDuration(healthKitWorkout.duration)}</Text>
              </View>
              {healthKitWorkout.calories != null && (
                <View style={styles.summaryItem}>
                  <Text size="sm" style={styles.summaryLabel}>
                    Calories
                  </Text>
                  <Text weight="bold">{Math.round(healthKitWorkout.calories)} kcal</Text>
                </View>
              )}
              {healthKitWorkout.heartRateAvg != null && (
                <View style={styles.summaryItem}>
                  <Text size="sm" style={styles.summaryLabel}>
                    Avg HR
                  </Text>
                  <Text weight="bold">{Math.round(healthKitWorkout.heartRateAvg)} bpm</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Manual workout entry */}
        {isManualWorkout && (
          <View style={styles.workoutSection}>
            <Text size="xs" weight="medium" style={styles.label}>
              EXERCISES
            </Text>
            {exercises.map((ex, exIdx) => (
              <View key={exIdx} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={ex.name}
                    onChangeText={(v) => updateExerciseName(exIdx, v)}
                    placeholder="Exercise name"
                  />
                  <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                    <Text style={{ color: "#E53935", fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {ex.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setRow}>
                    <Text size="xs" style={{ color: "#999", width: 30 }}>
                      #{setIdx + 1}
                    </Text>
                    <TextInput
                      style={styles.setInput}
                      value={set.reps?.toString() ?? ""}
                      onChangeText={(v) => updateSet(exIdx, setIdx, "reps", v)}
                      placeholder="Reps"
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.setInput}
                      value={set.weight?.toString() ?? ""}
                      onChangeText={(v) => updateSet(exIdx, setIdx, "weight", v)}
                      placeholder="Weight (kg)"
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.setInput}
                      value={set.durationSeconds?.toString() ?? ""}
                      onChangeText={(v) => updateSet(exIdx, setIdx, "durationSeconds", v)}
                      placeholder="Secs"
                      keyboardType="numeric"
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                  <Text size="sm" style={{ color: "#4A90D9" }}>
                    + Add Set
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addExerciseBtn} onPress={addExercise}>
              <Text weight="medium" style={{ color: "#4A90D9" }}>
                + Add Exercise
              </Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="Workout notes (optional)"
              multiline
            />
          </View>
        )}

        {/* Save button */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText} weight="bold">
                Save Activity
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 4,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  typeIcon: {
    fontSize: 24,
  },
  field: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  label: {
    color: "#888",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 8,
  },
  privacyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  privacyBtnActive: {
    backgroundColor: "#4A90D9",
  },
  privacyTextActive: {
    color: "#fff",
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    color: "#888",
    marginBottom: 2,
  },
  workoutSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  setInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  addSetBtn: {
    paddingVertical: 6,
    alignItems: "center",
  },
  addExerciseBtn: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
  },
  saveSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  saveBtn: {
    backgroundColor: "#4A90D9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 18,
  },
})

export default SaveActivityScreen
