"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { listAdventures, createAdventure, deleteAdventure } from "@/lib/adventures";
import type { Adventure, AdventureStatus } from "@fortamazing/lib";
import AdventureCard from "./components/AdventureCard";
import AdventureForm from "./components/AdventureForm";

export default function AdventuresPage() {
  const [user, setUser] = useState<User | null>(null);
  const [adventures, setAdventures] = useState<(Adventure & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const items = await listAdventures(uid);
      setAdventures(items);
    } catch (err) {
      console.error("Error loading adventures:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) void load(u.uid);
      else {
        setAdventures([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [load]);

  const handleCreate = async (data: { title: string; description?: string; status: AdventureStatus; privacy: "private" | "public"; targetDate?: string }) => {
    if (!user) return;
    await createAdventure({
      ...data,
      ownerId: user.uid,
    });
    setShowForm(false);
    await load(user.uid);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this adventure?")) return;
    await deleteAdventure(user.uid, id);
    await load(user.uid);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Adventures</h1>

      {!user && <p className="text-gray-500">Sign in to manage your adventures.</p>}

      {user && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              New Adventure
            </button>
          </div>

          {showForm && (
            <div className="mb-6 p-4 border rounded bg-gray-50">
              <h2 className="font-semibold mb-3">Create Adventure</h2>
              <AdventureForm
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
                submitLabel="Create"
              />
            </div>
          )}

          {loading ? (
            <p>Loading adventures...</p>
          ) : (
            <div className="space-y-3">
              {adventures.map((adv) => (
                <AdventureCard
                  key={adv.id}
                  adventure={adv}
                  onDelete={() => handleDelete(adv.id)}
                />
              ))}
              {adventures.length === 0 && (
                <p className="text-gray-400">No adventures yet. Create one to get started!</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
