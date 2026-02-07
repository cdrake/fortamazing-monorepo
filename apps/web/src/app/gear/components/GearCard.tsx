"use client";

import type { GearItem } from "@fortamazing/lib/types";

type Props = {
  item: GearItem & { id: string };
  onEdit: () => void;
  onDelete: () => void;
};

export default function GearCard({ item, onEdit, onDelete }: Props) {
  return (
    <div className="border rounded p-4 flex justify-between items-start">
      <div>
        <div className="font-semibold">{item.name}</div>
        <div className="text-sm text-gray-500">
          {item.category}
          {item.brand && ` — ${item.brand}`}
          {item.model && ` ${item.model}`}
        </div>
        {item.weight != null && (
          <div className="text-sm text-gray-600">
            {item.weight >= 1000
              ? `${(item.weight / 1000).toFixed(2)} kg`
              : `${item.weight} g`}
          </div>
        )}
        {item.notes && <div className="text-sm text-gray-400 mt-1">{item.notes}</div>}
        {item.retired && <span className="text-xs text-red-500 font-medium">Retired</span>}
      </div>

      <div className="flex gap-2">
        <button onClick={onEdit} className="text-sm text-blue-500 hover:underline">
          Edit
        </button>
        <button onClick={onDelete} className="text-sm text-red-500 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}
