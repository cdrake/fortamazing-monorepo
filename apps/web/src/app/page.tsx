"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, getUserRole } from "@/lib/firebase";

export default function HomePage() {
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const loadUserRole = async () => {
      if (user) {
        const role = await getUserRole(user);
        setIsSocialAdmin(role === "social-admin");
      }
    };
    loadUserRole();
  }, [user]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Fort Amazing</h1>

      <p className="mb-4 text-gray-600">
        Your adventure diary. Track activities, plan adventures, and manage your gear.
      </p>

      {/* Navigation */}
      <div className="mb-6 flex gap-4 flex-wrap">
        {user ? (
          <>
            <Link
              href="/hikes"
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Activities
            </Link>

            <Link
              href="/adventures"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:opacity-90"
            >
              Adventures
            </Link>

            <Link
              href="/gear"
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:opacity-90"
            >
              Gear
            </Link>

            <Link href="/diet" className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:opacity-90">
              Diet Log
            </Link>

            <Link href="/settings" className="text-primary hover:underline self-center">
              Settings
            </Link>

            <Link
              href={`/u/${encodeURIComponent(
                (user.email || "").replace(/@/g, ".")
              )}`}
              className="text-primary hover:underline self-center"
            >
              My Profile
            </Link>

            {isSocialAdmin && (
              <Link href="/admin" className="text-primary hover:underline self-center">
                Admin
              </Link>
            )}
          </>
        ) : (
          <Link href="/login" className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:opacity-90">
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
