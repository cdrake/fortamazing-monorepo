"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, updateUsername, updateProfilePicture } from "@/lib/firebase";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";

export default function UserSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [username, setUsername] = useState(user?.displayName || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "/default-avatar.png");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setUsername(user.displayName || "");
        setDisplayName(user.displayName || "");
        setPhotoURL(user.photoURL || "/default-avatar.png");
       
      } else {
        router.push("/login"); // ✅ Redirect if not logged in
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleUpdateProfile = async () => {
    try {
      if (user) {
        await updateProfile(user, { displayName });
        setMessage("✅ Profile updated successfully!");
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage("❌ Error updating profile: " + error.message);
      } else {
        setMessage("❌ An unknown error occurred.");
      }
    }
  };

  const handleUpdateUsername = async () => {
    try {
      if (user) {
        await updateUsername(user.uid, username);
        setMessage("✅ Username updated successfully!");
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage("❌ " + error.message);
      } else {
        setMessage("❌ An unknown error occurred.");
      }
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const newPhotoURL = await updateProfilePicture(user!.uid, e.target.files[0]);
        setPhotoURL(newPhotoURL);
        setMessage("✅ Profile picture updated!");
      } catch (error) {
        if (error instanceof Error) {
          setMessage("❌ Error updating profile picture: " + error.message);
        } else {
          setMessage("❌ An unknown error occurred.");
        }
      }
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">User Settings</h1>

      {/* ✅ Clickable Profile URL */}
      <p className="mb-2">
        Your profile URL:{" "}
        <Link
          href={`/u/${username}`}
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          fortamazing.com/u/{username}
        </Link>
      </p>

      {/* ✅ Username Input */}
      <input
        type="text"
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={handleUpdateUsername} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
        Update Username
      </button>

      {/* ✅ Display Name Input */}
      <input
        type="text"
        placeholder="Your display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="border p-2 rounded w-full mt-4 mb-2"
      />
      <button onClick={handleUpdateProfile} className="bg-green-500 text-white px-4 py-2 rounded w-full">
        Update Display Name
      </button>

      {/* ✅ Profile Picture Upload */}
      <div className="mt-4">
        <p className="mb-2">Profile Picture:</p>
        <Image src={photoURL} alt="Profile" width={80} height={80} className="rounded-full mb-2" />
        <input type="file" onChange={handleProfilePictureChange} className="border p-2 rounded w-full" />
      </div>

      {message && <p className="mt-2 text-gray-600">{message}</p>}
    </div>
  );
}
