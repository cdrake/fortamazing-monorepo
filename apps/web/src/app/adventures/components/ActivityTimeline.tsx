"use client";

import type { ActivityType, WorkoutData } from "@fortamazing/lib";
import { ACTIVITY_TYPE_ICON } from "@/lib/activityClassification";

type TimelineActivity = {
  id: string;
  type?: string;
  title?: string;
  startTime?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  elevationGainMeters?: number;
  workout?: WorkoutData;
  track?: {
    distanceMeters?: number;
    movingTimeSeconds?: number;
    elevationGainMeters?: number;
  };
  [key: string]: unknown;
};

type Props = {
  activities: TimelineActivity[];
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return <p className="text-gray-400 text-sm">No activities linked yet.</p>;
  }

  const totalDistance = activities.reduce((sum, a) => {
    const d = a.track?.distanceMeters ?? a.distanceMeters ?? 0;
    return sum + d;
  }, 0);

  const totalDuration = activities.reduce((sum, a) => {
    const d = a.track?.movingTimeSeconds ?? a.durationSeconds ?? 0;
    return sum + d;
  }, 0);

  const totalElevation = activities.reduce((sum, a) => {
    const d = a.track?.elevationGainMeters ?? a.elevationGainMeters ?? 0;
    return sum + d;
  }, 0);

  const totalWorkoutExercises = activities.reduce((sum, a) => {
    const w = a.workout as WorkoutData | undefined;
    return sum + (w?.exercises?.length ?? 0);
  }, 0);

  const totalWorkoutSets = activities.reduce((sum, a) => {
    const w = a.workout as WorkoutData | undefined;
    return sum + (w?.exercises?.reduce((s, ex) => s + (ex.sets?.length ?? 0), 0) ?? 0);
  }, 0);

  return (
    <div>
      <h3 className="font-semibold mb-2">Activity Timeline</h3>

      <div className="text-sm text-gray-500 mb-3 flex gap-4 flex-wrap">
        <span>{activities.length} activities</span>
        {totalDistance > 0 && <span>{(totalDistance / 1000).toFixed(1)} km</span>}
        {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
        {totalElevation > 0 && <span>{totalElevation.toFixed(0)} m gain</span>}
        {totalWorkoutExercises > 0 && <span>{totalWorkoutExercises} exercises, {totalWorkoutSets} sets</span>}
      </div>

      <div className="space-y-2">
        {activities.map((a) => {
          const icon = ACTIVITY_TYPE_ICON[(a.type as ActivityType) ?? "other"] ?? "🏔️";
          const isWorkout = a.type === "workout";
          const workout = a.workout as WorkoutData | undefined;
          const dist = a.track?.distanceMeters ?? a.distanceMeters;
          return (
            <div key={a.id} className="flex items-center gap-3 p-2 border rounded">
              <span className="flex-shrink-0" title={a.type ?? "activity"}>{icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.title || "Untitled"}</div>
                <div className="text-xs text-gray-500">
                  {a.type ?? "activity"}
                  {a.startTime && ` — ${new Date(a.startTime).toLocaleDateString()}`}
                  {!isWorkout && dist != null && (
                    <> &middot; {((dist as number) / 1000).toFixed(1)} km</>
                  )}
                  {isWorkout && workout && (
                    <> &middot; {workout.exercises?.length ?? 0} exercises</>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
