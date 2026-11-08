import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { notificationsApi, STUDENT_NOTIFICATIONS_UPDATED_EVENT } from "../lib/api";

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
      // Unarchived items return to the main feed (and may be unread).
      window.dispatchEvent(new Event(STUDENT_NOTIFICATIONS_UPDATED_EVENT));
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Archived Notifications</h1>
          <p className="text-sm text-ink-muted">Your archived announcements and updates.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={bulkUnarchive} disabled={!selectedIds.size} className="rounded-lg border border-border-light px-3 py-2 text-sm disabled:opacity-50">Unarchive</button>
          <button onClick={bulkTrash} disabled={!selectedIds.size} className="rounded-lg border border-border-light px-3 py-2 text-sm text-status-danger disabled:opacity-50">Move to Trash</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => (
          <label key={it.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-light bg-card-light p-4">
            <input type="checkbox" className="mt-1" checked={selectedIds.has(it.id)} onChange={() => toggleSelect(it.id)} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{it.title || "Notification"}</h3>
              <p className="mt-1 text-sm text-ink-muted line-clamp-2">{it.body || it.message}</p>
            </div>
            <div className="shrink-0 text-xs text-ink-muted">{it.createdAt ? new Date(it.createdAt.seconds ? it.createdAt.seconds * 1000 : it.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</div>
          </label>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-border-light bg-card-light px-4 py-10 text-center text-sm text-ink-muted">Nothing archived.</p>
        )}
      </div>
    </div>
  );
}
