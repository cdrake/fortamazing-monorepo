"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, getUserRole } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import Image from "next/image";

export default function AppBar() {
  const [user, setUser] = useState<User | null>(null);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);

  // ✅ Listen for Authentication State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const role = await getUserRole(currentUser);
        setIsSocialAdmin(role === "social-admin");
      } else {
        setIsSocialAdmin(false); // Reset role if signed out
      }
    });

    return () => unsubscribe(); // ✅ Cleanup on unmount
  }, []);

  // ✅ Handle Sign-Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-blue-600 text-white">
      {/* ✅ App Name */}
      <Link href="/" className="text-xl font-bold">
        Fort Amazing
      </Link>

      {/* ✅ Navigation Links */}
      <div className="flex items-center gap-4">
        {/* ✅ Always Visible Links */}
        <Link href="/" className="hover:underline">Home</Link>

        {/* ✅ Conditional Links Based on Auth */}
        {user ? (
          <>
            <Link href="/settings" className="hover:underline">Settings</Link>

            <Link href={`/u/${encodeURIComponent(user.email || "").replace(/@/g, ".")}`} className="hover:underline">
              My Profile
            </Link>

            {/* ✅ Show Avatar if Available */}
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt="User Avatar"
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <Image
                src="/default-avatar.png"
                alt="Default Avatar"
                width={32}
                height={32}
                className="rounded-full"
              />
            )}

            {/* ✅ Sign Out Button */}
            <button onClick={handleSignOut} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
              Sign Out
            </button>

            {/* ✅ Admin Panel Link (Only for Social Admins) */}
            {isSocialAdmin && (
              <Link href="/admin" className="bg-yellow-400 px-3 py-1 rounded hover:bg-yellow-500">
                Admin Panel
              </Link>
            )}
          </>
        ) : (
          <Link href="/login" className="bg-green-500 px-3 py-1 rounded hover:bg-green-600">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
