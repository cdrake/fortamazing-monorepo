import { useCallback, useEffect, useRef, useState } from "react"

import {
  getState,
  subscribe,
  startRecording,
  stopRecording,
  discardRecording,
  resumeRecording,
} from "@/lib/gpsRecorder"
import type { GpsTrackResult, RecordingState } from "@/lib/gpsTypes"

export function useGpsRecording() {
  const [recState, setRecState] = useState<RecordingState>(getState)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsub = subscribe(setRecState)
    // Try to resume any in-progress recording on mount
    void resumeRecording()
    return unsub
  }, [])

  // Elapsed time ticker
  useEffect(() => {
    if (recState.isRecording && recState.startedAt) {
      setElapsed(Math.floor((Date.now() - recState.startedAt) / 1000))
      timerRef.current = setInterval(() => {
        if (recState.startedAt) {
          setElapsed(Math.floor((Date.now() - recState.startedAt) / 1000))
        }
      }, 1000)
    } else {
      setElapsed(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [recState.isRecording, recState.startedAt])

  const start = useCallback(async (): Promise<boolean> => {
    return startRecording()
  }, [])

  const stop = useCallback(async (): Promise<GpsTrackResult | null> => {
    return stopRecording()
  }, [])

  const discard = useCallback(async () => {
    await discardRecording()
  }, [])

  const currentLocation =
    recState.points.length > 0
      ? {
          latitude: recState.points[recState.points.length - 1].latitude,
          longitude: recState.points[recState.points.length - 1].longitude,
        }
      : null

  return {
    isRecording: recState.isRecording,
    points: recState.points,
    elapsed,
    distance: recState.totalDistance,
    currentLocation,
    start,
    stop,
    discard,
  }
}
