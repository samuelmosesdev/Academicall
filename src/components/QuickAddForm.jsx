import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Generic quick-add form. Writing here goes straight to Firestore, so the
 * KPI cards, growth chart, and activity table update live via onSnapshot --
 * no mock data, no manual refresh.
 */
export default function QuickAddForm({ target, onDone }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const collectionName = target === "agent" ? "agents" : "users";
  const label = target === "agent" ? "agent" : "user";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, collectionName), {
        name: name.trim(),
        email: email.trim(),
        status: "active",
        plan: target === "agent" ? undefined : "free",
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "activityLog"), {
        userName: name.trim(),
        action: `New ${label} added by admin`,
        status: "success",
        reference: `#${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        createdAt: serverTimestamp(),
      });
      setName("");
      setEmail("");
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Full name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          placeholder={`Enter ${label} name`}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          placeholder={`Enter ${label} email`}
          required
        />
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : `Add ${label}`}
      </button>
    </form>
  );
}
