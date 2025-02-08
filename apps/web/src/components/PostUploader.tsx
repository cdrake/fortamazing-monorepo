"use client";
import { useState } from "react";
import { uploadPost } from "@/lib/firebase";

const categories: Record<string, string[]> = {
  Exercise: ["Running", "Strength Training", "Yoga"],
  Diet: ["Vegan", "Keto", "Paleo"],
  Wellness: ["Mental Health", "Sleep", "Stress Management"],
  Events: ["Workshops", "Marathons", "Online Webinars"],
  Equipment: ["Gym Gear", "Wearables", "Nutrition Supplements"],
};

export default function PostUploader({
  onPostUploaded,
}: {
  onPostUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    []
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    await uploadPost(
      file,
      caption,
      selectedCategories,
      selectedSubcategories,
      tags,
      date,
      time
    );
    onPostUploaded();
    setFile(null);
    setCaption("");
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setTags([]);
    setDate("");
    setTime("");
  };

  return (
    <div className="p-4 bg-white shadow-md rounded">
      <h2 className="text-xl font-bold mb-2">Create a Post</h2>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-2"
      />
      <input
        type="text"
        placeholder="Caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />

      {/* ✅ Multi-Checkbox for Categories */}
      <h3 className="text-md font-bold">Select Categories</h3>
      {Object.keys(categories).map((cat) => (
        <label key={cat} className="block">
          <input
            type="checkbox"
            value={cat}
            checked={selectedCategories.includes(cat)}
            onChange={(e) => {
              const newCategories = e.target.checked
                ? [...selectedCategories, cat]
                : selectedCategories.filter((c) => c !== cat);
              setSelectedCategories(newCategories);
            }}
            className="mr-2"
          />
          {cat}
        </label>
      ))}

      {/* ✅ Multi-Checkbox for Subcategories (Only Show Selected Categories) */}
      <h3 className="text-md font-bold mt-2">Select Subcategories</h3>
      {selectedCategories
        .flatMap((cat) => categories[cat] || [])
        .map((sub) => (
          <label key={sub} className="block">
            <input
              type="checkbox"
              value={sub}
              checked={selectedSubcategories.includes(sub)}
              onChange={(e) => {
                const newSubcategories = e.target.checked
                  ? [...selectedSubcategories, sub]
                  : selectedSubcategories.filter((s) => s !== sub);
                setSelectedSubcategories(newSubcategories);
              }}
              className="mr-2"
            />
            {sub}
          </label>
        ))}

      {/* ✅ Event Date & Time */}
      <h3 className="text-md font-bold mt-2">Event Date (Optional)</h3>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />

      <h3 className="text-md font-bold mt-2">Event Time (Optional)</h3>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />

      {/* ✅ Tag Input */}
      <input
        type="text"
        placeholder="Add tag"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <button
        onClick={() => setTags([...tags, tagInput.trim()])}
        className="bg-blue-500 text-white px-2 py-1 rounded mb-2"
      >
        Add Tag
      </button>

      {/* ✅ Display Tags */}
      <div className="flex gap-2 flex-wrap">
        {tags.map((tag, index) => (
          <span key={index} className="bg-gray-200 text-sm px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={handleUpload}
        className="bg-green-500 text-white px-4 py-2 rounded w-full mt-2"
      >
        Upload
      </button>
    </div>
  );
}
