"use client";
import { useEffect, useState } from "react";
import { fetchInvites, generateInvite, deleteInvite } from "@/lib/firebase";

interface Invite {
  id: string;
  email: string;
  code: string;
}

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvites = async () => {
      try {
        const fetchedInvites: Invite[] = await fetchInvites(); // ✅ Ensure correct type
        setInvites(fetchedInvites);
      } catch {
        setError("Failed to load invites.");
      }
    };

    loadInvites();
  }, []);

  const handleGenerateInvite = async () => {
    try {
      const inviteCode = await generateInvite(email);
      setInvites([...invites, { id: inviteCode, email, code: inviteCode }]); // ✅ Add new invite
      setEmail("");
    } catch {
      setError("Failed to generate invite.");
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    await deleteInvite(inviteId);
    setInvites(invites.filter((invite) => invite.id !== inviteId)); // ✅ Remove deleted invite
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Invite Management</h1>

      <div className="mb-4">
        <input
          type="email"
          placeholder="User Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded w-full mb-2"
        />
        <button onClick={handleGenerateInvite} className="bg-green-500 text-white px-4 py-2 rounded w-full">
          Generate Invite
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <h2 className="text-xl font-bold mt-4">Existing Invites</h2>
      <ul>
        {invites.map((invite) => (
          <li key={invite.id} className="border p-2 rounded flex justify-between items-center">
            <div>
              <p><strong>Email:</strong> {invite.email}</p>
              <p><strong>Code:</strong> {invite.code}</p>
            </div>
            <button
              onClick={() => handleDeleteInvite(invite.id)}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
