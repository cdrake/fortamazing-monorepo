"use client"

import type { Adventure, PackingListItem } from "@fortamazing/lib/types"
import type { DietRangeSummary } from "../lib/dietFetcher"

type ActivityLike = {
  id: string
  title?: string
  startTime?: string
  endTime?: string
  durationSeconds?: number
  photos?: { url?: string; downloadUrl?: string }[]
  photoCount?: number
  track?: {
    distanceMeters?: number
    movingTimeSeconds?: number
    elevationGainMeters?: number
  }
  distanceMeters?: number
  elevationGainMeters?: number
  [key: string]: unknown
}

type Props = {
  adventure: Adventure & { id: string }
  activities: ActivityLike[]
  dietSummary: DietRangeSummary | null
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export default function StoryTab({ adventure, activities, dietSummary }: Props) {
  const totalDistance = activities.reduce((sum, a) => {
    return sum + (a.track?.distanceMeters ?? a.distanceMeters ?? 0)
  }, 0)

  const totalMovingTime = activities.reduce((sum, a) => {
    return sum + (a.track?.movingTimeSeconds ?? a.durationSeconds ?? 0)
  }, 0)

  const totalElevation = activities.reduce((sum, a) => {
    return sum + (a.track?.elevationGainMeters ?? a.elevationGainMeters ?? 0)
  }, 0)

  const startTimes = activities
    .map((a) => a.startTime)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime())
  const endTimes = activities
    .map((a) => a.endTime ?? a.startTime)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime())

  const earliest = startTimes.length ? new Date(Math.min(...startTimes)) : null
  const latest = endTimes.length ? new Date(Math.max(...endTimes)) : null

  const allPhotos = activities.flatMap((a) =>
    (a.photos ?? [])
      .map((p) => p.downloadUrl ?? p.url)
      .filter(Boolean) as string[],
  )
  const photoHighlights = allPhotos.slice(0, 6)

  const packingList: PackingListItem[] = adventure.packingList ?? []
  const packedCount = packingList.filter((i) => i.packed).length
  const totalWeight = packingList.reduce((s, i) => s + ((i.weight ?? 0) * (i.quantity ?? 1)), 0)

  return (
    <div className="space-y-6">
      {/* Date range */}
      {earliest && latest && (
        <p className="text-sm text-gray-500">
          {earliest.toLocaleDateString()} &mdash; {latest.toLocaleDateString()}
        </p>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Distance" value={totalDistance > 0 ? formatDistance(totalDistance) : "--"} />
        <StatCard label="Moving Time" value={totalMovingTime > 0 ? formatDuration(totalMovingTime) : "--"} />
        <StatCard label="Elevation Gain" value={totalElevation > 0 ? `${Math.round(totalElevation)} m` : "--"} />
        <StatCard label="Activities" value={String(activities.length)} />
      </div>

      {/* Photo highlights */}
      {photoHighlights.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Photo Highlights</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {photoHighlights.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      {/* Equipment summary */}
      {packingList.length > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold mb-1">Equipment</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>{packingList.length} items &middot; {packedCount} packed</p>
            {totalWeight > 0 && <p>Total weight: {(totalWeight / 1000).toFixed(1)} kg</p>}
          </div>
        </div>
      )}

      {/* Diet summary */}
      {dietSummary && dietSummary.dayCount > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold mb-1">Nutrition</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>{dietSummary.dayCount} days tracked &middot; avg {dietSummary.avgDailyCalories} cal/day</p>
            <p>
              {dietSummary.totalCalories} cal total &middot;{" "}
              {dietSummary.totalProtein}g protein &middot;{" "}
              {dietSummary.totalFat}g fat &middot;{" "}
              {dietSummary.totalCarbs}g carbs
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
