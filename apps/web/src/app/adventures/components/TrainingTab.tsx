"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import type { FeatureCollection, Geometry } from "geojson"
import type { ActivityType, WorkoutData } from "@fortamazing/lib"
import { ACTIVITY_TYPE_ICON } from "@/lib/activityClassification"
import WorkoutDataView from "@/components/WorkoutDataView"
import { computeTravelSegments, travelSegmentToGeoJSON } from "../lib/trackStitching"
import type { DayTrack } from "@/app/hikes/lib/trackUtils"

const MapView = dynamic(() => import("@/app/hikes/components/MapView"), { ssr: false })

const TRACK_COLORS = [
  "#3388ff", "#e6194b", "#3cb44b", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45",
]

type ActivityLike = {
  id: string
  title?: string
  type?: string
  startTime?: string
  distanceMeters?: number
  durationSeconds?: number
  elevationGainMeters?: number
  workout?: WorkoutData
  track?: {
    distanceMeters?: number
    movingTimeSeconds?: number
    elevationGainMeters?: number
    startLocation?: { latitude: number; longitude: number }
    endLocation?: { latitude: number; longitude: number }
    days?: { id: string; name?: string; geojson?: unknown; color?: string; visible?: boolean }[]
    combinedGeojson?: unknown
  }
  [key: string]: unknown
}

type Props = {
  activities: ActivityLike[]
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function hasTrackData(act: ActivityLike): boolean {
  if (act.track?.days && act.track.days.length > 0) return true
  if (act.track?.combinedGeojson) return true
  return false
}

export default function TrainingTab({ activities }: Props) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)

  const activitiesWithTracks = useMemo(
    () => activities.filter((a) => hasTrackData(a)),
    [activities],
  )
  const workoutsWithoutTracks = useMemo(
    () => activities.filter((a) => !hasTrackData(a) && (a.workout || a.type === "workout")),
    [activities],
  )

  const dayTracks = useMemo<DayTrack[]>(() => {
    const tracks: DayTrack[] = []
    activitiesWithTracks.forEach((act, idx) => {
      const color = TRACK_COLORS[idx % TRACK_COLORS.length]

      // Try days first, then combinedGeojson, then skip
      if (act.track?.days && act.track.days.length > 0) {
        act.track.days.forEach((day) => {
          if (!day.geojson) return
          tracks.push({
            id: `${act.id}-${day.id}`,
            name: day.name ?? act.title ?? "Track",
            geojson: day.geojson as FeatureCollection<Geometry>,
            color: day.color ?? color,
            visible: true,
          })
        })
      } else if (act.track?.combinedGeojson) {
        tracks.push({
          id: act.id,
          name: act.title ?? "Track",
          geojson: act.track.combinedGeojson as FeatureCollection<Geometry>,
          color,
          visible: true,
        })
      }
    })
    return tracks
  }, [activitiesWithTracks])

  const travelGeojson = useMemo<FeatureCollection<Geometry> | undefined>(() => {
    const segments = computeTravelSegments(activitiesWithTracks)
    if (segments.length === 0) return undefined
    return {
      type: "FeatureCollection",
      features: segments.map(travelSegmentToGeoJSON),
    }
  }, [activitiesWithTracks])

  if (activities.length === 0) {
    return <p className="text-gray-400 text-sm">No activities linked yet.</p>
  }

  return (
    <div className="space-y-4">
      {dayTracks.length > 0 && (
        <MapView
          dayTracks={dayTracks}
          combinedGeojson={travelGeojson}
          activeTrackId={activeTrackId ?? undefined}
          onTrackClick={setActiveTrackId}
          style={{ height: 450 }}
          className="rounded-xl overflow-hidden border"
        />
      )}

      {activitiesWithTracks.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Activities</h3>
          {activitiesWithTracks.map((a, idx) => {
            const color = TRACK_COLORS[idx % TRACK_COLORS.length]
            const dist = a.track?.distanceMeters ?? a.distanceMeters ?? 0
            const dur = a.track?.movingTimeSeconds ?? a.durationSeconds ?? 0
            const icon = ACTIVITY_TYPE_ICON[(a.type as ActivityType) ?? "other"] ?? "🏔️"
            const isActive = activeTrackId === a.id ||
              (a.track?.days ?? []).some((d) => activeTrackId === `${a.id}-${d.id}`)
            const workout = a.workout as WorkoutData | undefined
            return (
              <button
                key={a.id}
                onClick={() => setActiveTrackId(a.id)}
                className={`w-full flex items-center gap-3 p-2 border rounded text-left transition-colors ${isActive ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    <span className="mr-1">{icon}</span>
                    {a.title || "Untitled"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.type ?? "activity"}
                    {a.startTime && ` — ${new Date(a.startTime).toLocaleDateString()}`}
                    {dist > 0 && <> &middot; {(dist / 1000).toFixed(1)} km</>}
                    {dur > 0 && <> &middot; {formatDuration(dur)}</>}
                    {workout && <> &middot; <WorkoutDataView workout={workout} compact /></>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {workoutsWithoutTracks.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Workouts</h3>
          {workoutsWithoutTracks.map((a) => {
            const icon = ACTIVITY_TYPE_ICON[(a.type as ActivityType) ?? "workout"] ?? "🏋️"
            const dur = a.durationSeconds ?? 0
            const workout = a.workout as WorkoutData | undefined
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-2 border rounded"
              >
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title || "Untitled"}</div>
                  <div className="text-xs text-gray-500">
                    {a.type ?? "workout"}
                    {a.startTime && ` — ${new Date(a.startTime).toLocaleDateString()}`}
                    {dur > 0 && <> &middot; {formatDuration(dur)}</>}
                    {workout && <> &middot; <WorkoutDataView workout={workout} compact /></>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
