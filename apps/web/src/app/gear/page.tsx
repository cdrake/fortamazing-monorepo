"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { listGear, createGearItem, updateGearItem, deleteGearItem } from "@/lib/gear";
import type { GearItem, GearCategory } from "@fortamazing/lib/types";
import GearList from "./components/GearList";
import GearForm from "./components/GearForm";

export default function GearPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<(GearItem & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const gear = await listGear(uid);
      setItems(gear);
    } catch (err) {
      console.error("Error loading gear:", err);
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
        setItems([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [load]);

  const handleCreate = async (data: { name: string; category: GearCategory; weight?: number; brand?: string; model?: string; notes?: string }) => {
    if (!user) return;
    await createGearItem({ ...data, ownerId: user.uid });
    setShowForm(false);
    await load(user.uid);
  };

  const handleUpdate = async (data: { name: string; category: GearCategory; weight?: number; brand?: string; model?: string; notes?: string }) => {
    if (!user || !editingId) return;
    await updateGearItem(user.uid, editingId, data);
    setEditingId(null);
    await load(user.uid);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this gear item?")) return;
    await deleteGearItem(user.uid, id);
    await load(user.uid);
  };

  const editingItem = editingId ? items.find((i) => i.id === editingId) : null;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gear Inventory</h1>

      {!user && <p className="text-gray-500">Sign in to manage your gear.</p>}

      {user && (
        <>
          <div className="mb-4">
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Add Gear
            </button>
          </div>

          {(showForm || editingId) && (
            <div className="mb-6 p-4 border rounded bg-gray-50">
              <h2 className="font-semibold mb-3">{editingId ? "Edit Gear" : "New Gear Item"}</h2>
              <GearForm
                initial={editingItem ? {
                  name: editingItem.name,
                  category: editingItem.category,
                  weight: editingItem.weight,
                  brand: editingItem.brand,
                  model: editingItem.model,
                  notes: editingItem.notes,
                } : undefined}
                onSubmit={editingId ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditingId(null); }}
                submitLabel={editingId ? "Update" : "Add"}
              />
            </div>
          )}

          {loading ? (
            <p>Loading gear...</p>
          ) : (
            <GearList
              items={items}
              onEdit={(id) => { setEditingId(id); setShowForm(false); }}
              onDelete={handleDelete}
            />
          )}
        </>
      )}
    </div>
  );
}
