"use client";

type TimelineActivity = {
  id: string;
  type?: string;
  title?: string;
  startTime?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  elevationGainMeters?: number;
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

  return (
    <div>
      <h3 className="font-semibold mb-2">Activity Timeline</h3>

      <div className="text-sm text-gray-500 mb-3 flex gap-4">
        <span>{activities.length} activities</span>
        {totalDistance > 0 && <span>{(totalDistance / 1000).toFixed(1)} km</span>}
        {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
        {totalElevation > 0 && <span>{totalElevation.toFixed(0)} m gain</span>}
      </div>

      <div className="space-y-2">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-2 border rounded">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{a.title || "Untitled"}</div>
              <div className="text-xs text-gray-500">
                {a.type ?? "activity"}
                {a.startTime && ` — ${new Date(a.startTime).toLocaleDateString()}`}
                {(a.track?.distanceMeters ?? a.distanceMeters) != null && (
                  <> &middot; {(((a.track?.distanceMeters ?? a.distanceMeters) as number) / 1000).toFixed(1)} km</>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
