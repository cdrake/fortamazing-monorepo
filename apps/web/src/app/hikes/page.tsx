"use client";

import TrackUploader from "./components/TrackUploader";

export default function HikesPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Hikes</h1>

      <TrackUploader />

      {/* You can also add a list of uploaded hikes here later */}
    </div>
  );
}
