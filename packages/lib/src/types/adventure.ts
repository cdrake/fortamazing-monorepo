import type { Privacy } from "./privacy"
import type { ActivityPhoto } from "./activityPhoto"

export type AdventureStatus = "planning" | "in_progress" | "completed" | "abandoned"

export type PackingListItem = {
  gearId?: string
  name: string
  category?: string
  weight?: number
  packed: boolean
  quantity?: number
  notes?: string
}

export type Adventure = {
  ownerId: string
  title: string
  description?: string

  createdAt: string
  updatedAt: string

  status: AdventureStatus
  privacy: Privacy

  targetDate?: string
  startDate?: string
  endDate?: string

  tags?: string[]
  coverPhoto?: ActivityPhoto

  activityCount?: number
  totalDistanceMeters?: number
  totalDurationSeconds?: number
  totalElevationGainMeters?: number

  packingList?: PackingListItem[]

  storyContent?: string
}
