"use client";
import { useState } from "react";
import { uploadPost, auth } from "@/lib/firebase";

export default function PostUploader({ onPostUploaded }: { onPostUploaded: () => void }) {
  const [image, setImage] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!auth.currentUser) {
      setError("You must be signed in to post.");
      return;
    }

    if (!auth.currentUser.emailVerified) {
      setError("You must verify your email before posting.");
      return;
    }

    if (!image) {
      setError("Please select an image.");
      return;
    }

    try {
      await uploadPost(image, caption);
      setImage(null); // ✅ Clear image input
      setCaption(""); // ✅ Clear caption input
      setError(null);
      onPostUploaded(); // ✅ Refresh post list
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Create a Post</h2>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
        className="mb-2"
      />
      <input
        type="text"
        placeholder="Write a caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      {error && <p className="text-red-500">{error}</p>}
      <button onClick={handleUpload} className="bg-blue-500 text-white px-4 py-2 rounded">
        Upload Post
      </button>
    </div>
  );
}
