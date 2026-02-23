"use client"

import type { WorkoutData } from "@fortamazing/lib"

type Props = {
  workout: WorkoutData
  compact?: boolean
}

export default function WorkoutDataView({ workout, compact }: Props) {
  const exercises = workout.exercises ?? []

  if (exercises.length === 0) {
    return <p className="text-sm text-gray-400">No exercises recorded.</p>
  }

  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0)

  if (compact) {
    return (
      <span className="text-xs text-gray-500">
        {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}, {totalSets} set{totalSets !== 1 ? "s" : ""}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {exercises.map((ex, ei) => (
        <div key={ei}>
          <h4 className="font-medium text-sm">{ex.name}</h4>
          {ex.notes && <p className="text-xs text-gray-500 mb-1">{ex.notes}</p>}
          {ex.sets.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left py-1 pr-2">Set</th>
                  <th className="text-left py-1 pr-2">Reps</th>
                  <th className="text-left py-1 pr-2">Weight</th>
                  <th className="text-left py-1 pr-2">Duration</th>
                  <th className="text-left py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((set, si) => (
                  <tr key={si} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{si + 1}</td>
                    <td className="py-1 pr-2">{set.reps ?? "—"}</td>
                    <td className="py-1 pr-2">{set.weight != null ? `${set.weight} kg` : "—"}</td>
                    <td className="py-1 pr-2">
                      {set.durationSeconds != null ? `${set.durationSeconds}s` : "—"}
                    </td>
                    <td className="py-1 text-gray-400">{set.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {workout.notes && (
        <p className="text-xs text-gray-500 mt-2">{workout.notes}</p>
      )}
    </div>
  )
}
