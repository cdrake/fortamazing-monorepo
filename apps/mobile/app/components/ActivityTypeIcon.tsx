import React from "react"
import { Text } from "@/components/Text"
import type { ActivityType } from "@/lib/activityClassification"
import { ACTIVITY_TYPE_ICON } from "@/lib/activityClassification"

type Props = {
  type: ActivityType
  size?: number
}

export default function ActivityTypeIcon({ type, size = 16 }: Props) {
  const icon = ACTIVITY_TYPE_ICON[type] ?? "🏔️"
  return <Text style={{ fontSize: size }}>{icon}</Text>
}
