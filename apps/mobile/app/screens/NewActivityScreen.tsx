import React from "react"
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import {
  ACTIVITY_TYPE_ICON,
  ACTIVITY_TYPE_LABEL,
  type ActivityType,
} from "@/lib/activityClassification"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = AppStackScreenProps<"NewActivity">

const GPS_TYPES: ActivityType[] = ["hike", "walk", "run", "bike", "climb", "ski", "kayak", "swim"]
const ALL_TYPES: ActivityType[] = [...GPS_TYPES, "workout", "other"]

export const NewActivityScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets()

  const handleSelect = (type: ActivityType) => {
    if (type === "workout") {
      navigation.navigate("SaveActivity", { type: "workout" })
    } else {
      navigation.navigate("Recording", { type })
    }
  }

  return (
    <Screen preset="scroll" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text size="lg">{Platform.OS === "ios" ? "‹ Back" : "← Back"}</Text>
        </TouchableOpacity>
        <Text size="xl" weight="bold">
          New Activity
        </Text>
      </View>

      <View style={styles.grid}>
        {ALL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={styles.typeCard}
            onPress={() => handleSelect(type)}
            activeOpacity={0.7}
          >
            <Text style={styles.typeIcon}>{ACTIVITY_TYPE_ICON[type]}</Text>
            <Text size="xs" weight="medium">
              {ACTIVITY_TYPE_LABEL[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.importSection}>
        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => navigation.navigate("HealthKitImport")}
          activeOpacity={0.7}
        >
          <Text style={styles.importIcon}>❤️</Text>
          <Text weight="medium">Import from Apple Health</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  typeCard: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  typeIcon: {
    fontSize: 28,
  },
  importSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  importIcon: {
    fontSize: 22,
  },
})

export default NewActivityScreen
