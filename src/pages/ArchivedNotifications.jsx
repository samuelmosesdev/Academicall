import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";

export default function ArchivedNotifications() {
  const { user, authMode } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      notificationsApi.list(true).then(({ notifications = [] }) => alive && setItems(notifications)).catch(() => {});
      return () => { alive = false; };
    }
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("archived", "==", true),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user, authMode]);

  function toggleSelect(id) {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  }

  async function bulkUnarchive() {
    if (selectedIds.size === 0) return;
    if (authMode === "api") {
      await Promise.all([...selectedIds].map((id) => notificationsApi.update(id, { archived: false })));
      setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      return;
    }
    const batch = writeBatch(db);
    selectedIds.forEach((id) => {
      batch.update(doc(db, "notifications", id), { archived: false, archivedAt: null });
    });
    await batch.commit();
    setSelectedIds(new Set());
  }

  async function bulkTrash() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} notifications to Trash?`)) return;
    if (authMode === "api") {
      await Promise.all([...selectedIds].map((id) => notificationsApi.update(id, { archived: false, deleted: true })));
      setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      return;
    }
    const batch = writeBatch(db);
    selectedIds.forEach((id) => {
      batch.update(doc(db, "notifications", id), { deleted: true, deletedAt: serverTimestamp() });
    });
    await batch.commit();
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Archived Notifications</h1>
          <p className="text-sm text-ink-muted">Your archived announcements and updates.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={bulkUnarchive} className="rounded-lg border px-3 py-2 text-sm">Unarchive</button>
          <button onClick={bulkTrash} className="rounded-lg border px-3 py-2 text-sm text-status-danger">Move to Trash</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 rounded-2xl border p-4">
            <input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => toggleSelect(it.id)} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{it.title || "Notification"}</h3>
              <p className="mt-1 text-sm text-ink-muted line-clamp-2">{it.body || it.message}</p>
            </div>
            <div className="text-xs text-ink-muted">{new Date(it.createdAt?.seconds * 1000 || it.createdAt || Date.now()).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
