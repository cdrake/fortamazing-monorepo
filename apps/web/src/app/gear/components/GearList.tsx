"use client";

import type { GearItem, GearCategory } from "@fortamazing/lib";
import GearCard from "./GearCard";
import { useState } from "react";

const ALL_CATEGORIES: GearCategory[] = [
  "shelter", "sleep", "clothing", "cooking", "navigation",
  "safety", "hydration", "electronics", "footwear", "other",
];

type Props = {
  items: (GearItem & { id: string })[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function GearList({ items, onEdit, onDelete }: Props) {
  const [filterCategory, setFilterCategory] = useState<GearCategory | "all">("all");

  const filtered = filterCategory === "all"
    ? items
    : items.filter((i) => i.category === filterCategory);

  const totalWeight = filtered.reduce((sum, i) => sum + (i.weight ?? 0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as GearCategory | "all")}
          className="border rounded px-3 py-1"
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-500">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""} &middot;{" "}
          {totalWeight >= 1000
            ? `${(totalWeight / 1000).toFixed(2)} kg`
            : `${totalWeight} g`}
        </span>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <GearCard
            key={item.id}
            item={item}
            onEdit={() => onEdit(item.id)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-400">No gear items found.</p>
        )}
      </div>
    </div>
  );
}
