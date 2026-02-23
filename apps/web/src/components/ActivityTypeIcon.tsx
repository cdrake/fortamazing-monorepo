"use client"

import type { ActivityType } from "@fortamazing/lib"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL } from "@/lib/activityClassification"

type Props = {
  type: ActivityType
  showLabel?: boolean
}

export default function ActivityTypeIcon({ type, showLabel }: Props) {
  const icon = ACTIVITY_TYPE_ICON[type] ?? "🏔️"
  const label = ACTIVITY_TYPE_LABEL[type] ?? type

  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span>{icon}</span>
      {showLabel && <span className="text-sm">{label}</span>}
    </span>
  )
}
