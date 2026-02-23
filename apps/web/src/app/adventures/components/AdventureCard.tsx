"use client";

import type { Adventure, AdventureStatus } from "@fortamazing/lib";
import Link from "next/link";

const STATUS_COLORS: Record<AdventureStatus, string> = {
  planning: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  abandoned: "bg-gray-100 text-gray-500",
};

type Props = {
  adventure: Adventure & { id: string };
  onDelete: () => void;
};

export default function AdventureCard({ adventure, onDelete }: Props) {
  const statusLabel = adventure.status.replace("_", " ");

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-start">
        <div>
          <Link
            href={`/adventures/${adventure.id}`}
            className="text-lg font-semibold text-blue-600 hover:underline"
          >
            {adventure.title}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[adventure.status]}`}>
              {statusLabel}
            </span>
            <span className="text-sm text-gray-500">{adventure.privacy}</span>
          </div>
        </div>
        <button onClick={onDelete} className="text-sm text-red-500 hover:underline">
          Delete
        </button>
      </div>

      {adventure.description && (
        <p className="text-sm text-gray-600 mt-2">{adventure.description}</p>
      )}

      <div className="text-xs text-gray-400 mt-2 flex gap-3">
        {adventure.targetDate && <span>Target: {adventure.targetDate}</span>}
        {adventure.activityCount != null && <span>{adventure.activityCount} activities</span>}
        {adventure.totalDistanceMeters != null && (
          <span>{(adventure.totalDistanceMeters / 1000).toFixed(1)} km</span>
        )}
      </div>
    </div>
  );
}
