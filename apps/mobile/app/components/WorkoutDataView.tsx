import { View } from "react-native"

import { Text } from "@/components/Text"
import type { WorkoutData } from "@/lib/activityClassification"

type Props = {
  workout: WorkoutData
}

export default function WorkoutDataView({ workout }: Props) {
  const exercises = workout.exercises ?? []

  if (exercises.length === 0) {
    return <Text style={{ color: "#999", fontSize: 14 }}>No exercises recorded.</Text>
  }

  return (
    <View style={{ gap: 16 }}>
      {exercises.map((ex, ei) => (
        <View key={ei}>
          <Text style={{ fontWeight: "600", fontSize: 15, marginBottom: 4 }}>{ex.name}</Text>
          {ex.notes ? (
            <Text style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>{ex.notes}</Text>
          ) : null}
          {ex.sets.map((set, si) => (
            <View
              key={si}
              style={{
                flexDirection: "row",
                paddingVertical: 4,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 12, color: "#999", width: 30 }}>#{si + 1}</Text>
              <Text style={{ fontSize: 12, flex: 1 }}>
                {set.reps != null ? `${set.reps} reps` : ""}
                {set.weight != null ? ` × ${set.weight} kg` : ""}
                {set.durationSeconds != null ? ` ${set.durationSeconds}s` : ""}
              </Text>
              {set.notes ? <Text style={{ fontSize: 11, color: "#999" }}>{set.notes}</Text> : null}
            </View>
          ))}
        </View>
      ))}
      {workout.notes ? (
        <Text style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{workout.notes}</Text>
      ) : null}
    </View>
  )
}
