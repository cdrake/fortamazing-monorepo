"use client";

import { useState } from "react";
import type { PackingListItem } from "@fortamazing/lib";

type Props = {
  items: PackingListItem[];
  onChange: (items: PackingListItem[]) => void;
  gearItems?: { id: string; name: string; category?: string; weight?: number }[];
};

export default function PackingList({ items, onChange, gearItems = [] }: Props) {
  const [newItemName, setNewItemName] = useState("");

  const togglePacked = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], packed: !updated[index].packed };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addCustomItem = () => {
    if (!newItemName.trim()) return;
    onChange([...items, { name: newItemName.trim(), packed: false, quantity: 1 }]);
    setNewItemName("");
  };

  const addFromGear = (gearId: string) => {
    const gear = gearItems.find((g) => g.id === gearId);
    if (!gear) return;
    // Don't add duplicates
    if (items.some((i) => i.gearId === gearId)) return;
    onChange([
      ...items,
      {
        gearId,
        name: gear.name,
        category: gear.category,
        weight: gear.weight,
        packed: false,
        quantity: 1,
      },
    ]);
  };

  const packedCount = items.filter((i) => i.packed).length;
  const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0) * (i.quantity ?? 1), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-semibold">Packing List</h3>
        <span className="text-sm text-gray-500">
          {packedCount}/{items.length} packed
          {totalWeight > 0 && (
            <> &middot; {totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} kg` : `${totalWeight} g`}</>
          )}
        </span>
      </div>

      <ul className="space-y-1 mb-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.packed}
              onChange={() => togglePacked(idx)}
              className="rounded"
            />
            <span className={item.packed ? "line-through text-gray-400" : ""}>
              {item.name}
              {item.quantity && item.quantity > 1 && ` x${item.quantity}`}
              {item.weight != null && (
                <span className="text-xs text-gray-400 ml-1">({item.weight}g)</span>
              )}
            </span>
            <button
              onClick={() => removeItem(idx)}
              className="text-xs text-red-400 hover:text-red-600 ml-auto"
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
          placeholder="Add custom item..."
          className="border rounded px-2 py-1 text-sm flex-1"
        />
        <button
          onClick={addCustomItem}
          disabled={!newItemName.trim()}
          className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {gearItems.length > 0 && (
        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">Add from gear inventory:</label>
          <select
            onChange={(e) => { addFromGear(e.target.value); e.target.value = ""; }}
            className="border rounded px-2 py-1 text-sm w-full"
            defaultValue=""
          >
            <option value="" disabled>Select gear...</option>
            {gearItems
              .filter((g) => !items.some((i) => i.gearId === g.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.weight != null ? `(${g.weight}g)` : ""}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}
