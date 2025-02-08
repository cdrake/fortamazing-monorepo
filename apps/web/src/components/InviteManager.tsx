"use client";
import { useEffect, useState } from "react";
import { generateInvite, fetchInvites, deleteInvite } from "@/lib/firebase";

export default function InviteManager() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<{ id: string; email: string; code: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvites = async () => {
      try {
        const fetchedInvites = await fetchInvites();
        setInvites(fetchedInvites);
      } catch (err) {
        console.error("Error loading invites:", err);
      }
    };

    loadInvites();
  }, []);

  const handleGenerateInvite = async () => {
    try {
      const inviteCode = await generateInvite(email);
      setInvites([...invites, { id: inviteCode, email, code: inviteCode }]);
      setEmail("");
    } catch (err) {
      console.error("Error generating invite:", err);
      setError("Failed to generate invite.");
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId);
      setInvites(invites.filter((invite) => invite.id !== inviteId));
    } catch (err) {
      console.error("Error deleting invite:", err);
      setError("Failed to delete invite.");
    }
  };

  return (
    <div className="p-4 bg-white shadow-md rounded">
      <h2 className="text-xl font-bold mb-2">Invite Management</h2>

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

      <h3 className="text-lg font-bold mt-4">Existing Invites</h3>
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
