import * as Location from "expo-location"
import type { FeatureCollection, LineString, Position } from "geojson"

import { haversineDistance } from "@/lib/geoUtils"
import type { GpsPoint, GpsTrackResult, RecordingState } from "@/lib/gpsTypes"
import { load, save, remove } from "@/utils/storage"

const TASK_NAME = "BACKGROUND_LOCATION"
const STORAGE_KEY = "gps_recording_state"

let state: RecordingState = {
  isRecording: false,
  startedAt: null,
  points: [],
  totalDistance: 0,
}

let listeners: Array<(s: RecordingState) => void> = []

function notify() {
  for (const fn of listeners) fn(state)
}

export function subscribe(fn: (s: RecordingState) => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export function getState(): RecordingState {
  return state
}

function persist() {
  save(STORAGE_KEY, state)
}

export function handleLocationUpdate(locations: Location.LocationObject[]) {
  if (!state.isRecording) return

  for (const loc of locations) {
    const point: GpsPoint = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      timestamp: loc.timestamp,
      speed: loc.coords.speed,
      accuracy: loc.coords.accuracy,
    }

    if (state.points.length > 0) {
      const prev = state.points[state.points.length - 1]
      state.totalDistance += haversineDistance(
        prev.latitude,
        prev.longitude,
        point.latitude,
        point.longitude,
      )
    }

    state.points.push(point)
  }

  persist()
  notify()
}

export async function startRecording(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
  if (fgStatus !== "granted") return false

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
  if (bgStatus !== "granted") return false

  state = {
    isRecording: true,
    startedAt: Date.now(),
    points: [],
    totalDistance: 0,
  }
  persist()

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Recording activity",
      notificationBody: "FortAmazing is recording your GPS track",
    },
  })

  notify()
  return true
}

export async function stopRecording(): Promise<GpsTrackResult | null> {
  if (!state.isRecording || state.points.length < 2) {
    await discardRecording()
    return null
  }

  const hasTask = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false)
  if (hasTask) {
    await Location.stopLocationUpdatesAsync(TASK_NAME)
  }

  const result = buildResult(state)

  state = { isRecording: false, startedAt: null, points: [], totalDistance: 0 }
  remove(STORAGE_KEY)
  notify()

  return result
}

export async function discardRecording() {
  const hasTask = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false)
  if (hasTask) {
    await Location.stopLocationUpdatesAsync(TASK_NAME)
  }

  state = { isRecording: false, startedAt: null, points: [], totalDistance: 0 }
  remove(STORAGE_KEY)
  notify()
}

export async function resumeRecording(): Promise<boolean> {
  const saved = load<RecordingState>(STORAGE_KEY)
  if (!saved || !saved.isRecording) return false

  state = saved
  notify()

  // Check if background task is still running; if not, restart it
  const hasTask = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false)
  if (!hasTask) {
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status === "granted") {
      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Recording activity",
          notificationBody: "FortAmazing is recording your GPS track",
        },
      })
    }
  }

  return true
}

function buildResult(s: RecordingState): GpsTrackResult {
  const coordinates: Position[] = s.points.map((p) => {
    const pos: Position = [p.longitude, p.latitude]
    if (p.altitude != null) pos.push(p.altitude)
    return pos
  })

  const geojson: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    ],
  }

  const startedAt = s.startedAt ?? s.points[0].timestamp
  const endedAt = s.points[s.points.length - 1].timestamp

  let elevationGain: number | null = null
  let elevationLoss: number | null = null
  const elevPoints = s.points.filter((p) => p.altitude != null)
  if (elevPoints.length >= 2) {
    elevationGain = 0
    elevationLoss = 0
    for (let i = 1; i < elevPoints.length; i++) {
      const diff = elevPoints[i].altitude! - elevPoints[i - 1].altitude!
      if (diff > 0) elevationGain += diff
      else elevationLoss += Math.abs(diff)
    }
  }

  return {
    geojson,
    distance: s.totalDistance,
    duration: (endedAt - startedAt) / 1000,
    elevationGain,
    elevationLoss,
    startedAt,
    endedAt,
  }
}
