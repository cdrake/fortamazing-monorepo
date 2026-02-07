"use client";

import { useState } from "react";
import type { AdventureStatus } from "@fortamazing/lib";

const STATUSES: AdventureStatus[] = ["planning", "in_progress", "completed", "abandoned"];

type AdventureFormData = {
  title: string;
  description?: string;
  status: AdventureStatus;
  privacy: "private" | "public";
  targetDate?: string;
};

type Props = {
  initial?: Partial<AdventureFormData>;
  onSubmit: (data: AdventureFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
};

export default function AdventureForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<AdventureStatus>(initial?.status ?? "planning");
  const [privacy, setPrivacy] = useState<"private" | "public">(initial?.privacy ?? "private");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        privacy,
        targetDate: targetDate || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded px-3 py-2"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdventureStatus)}
            className="w-full border rounded px-3 py-2"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Privacy</label>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as "private" | "public")}
            className="w-full border rounded px-3 py-2"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
