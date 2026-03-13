import type { FC } from "react"
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import {
  ACTIVITY_TYPE_ICON,
  ACTIVITY_TYPE_LABEL,
  type ActivityType,
} from "@/lib/activityClassification"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"

type Props = AppStackScreenProps<"NewActivity">

const GPS_TYPES: ActivityType[] = ["hike", "walk", "run", "bike", "climb", "ski", "kayak", "swim"]
const ALL_TYPES: ActivityType[] = [...GPS_TYPES, "workout", "other"]

export const NewActivityScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets()
  const {
    theme: { colors },
  } = useAppTheme()

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
            style={[styles.typeCard, { backgroundColor: colors.palette.neutral200 }]}
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
          style={[styles.importBtn, { backgroundColor: colors.palette.neutral200 }]}
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
  backBtn: {
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
  },
  header: {
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  importBtn: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  importIcon: {
    fontSize: 22,
  },
  importSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  typeCard: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 12,
    gap: 4,
    justifyContent: "center",
    width: "22%",
  },
  typeIcon: {
    fontSize: 28,
  },
})

export default NewActivityScreen
