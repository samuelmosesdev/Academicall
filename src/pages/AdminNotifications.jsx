import { useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect } from "react";
import { Bell, CheckCheck, Megaphone, UserPlus, AlertCircle } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";
import { useNotifications } from "../hooks/useNotifications";

export default function AdminNotifications() {
  const { authMode } = useAuth();
  const { refresh: refreshBadge } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | unread

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      notificationsApi.listAdmin().then(({ notifications = [] }) => {
        if (alive) setItems(notifications);
      }).catch(() => {}).finally(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    // Prefer admin-relevant notifications
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // Show items meant for admin (no userId, or explicit admin flags)
          .filter((n) => n.readByAdmin !== true || n.type === "announcement_published" || !n.userId);
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  const visible = useMemo(() => {
    if (filter === "unread") return items.filter((n) => n.readByAdmin !== true);
    return items;
  }, [items, filter]);

  const unreadCount = items.filter((n) => n.readByAdmin !== true).length;

  async function markRead(id) {
    if (authMode === "api") {
      await notificationsApi.markAdminRead(id);
      setItems((previous) => previous.map((item) => item.id === id ? { ...item, readByAdmin: true, readAt: new Date().toISOString() } : item));
      refreshBadge();
      return;
    }
    await updateDoc(doc(db, "notifications", id), { readByAdmin: true, readAt: serverTimestamp() });
  }

  async function markAllRead() {
    if (authMode === "api") {
      await notificationsApi.markAllAdminRead();
      setItems((previous) => previous.map((item) => ({ ...item, readByAdmin: true, readAt: new Date().toISOString() })));
      refreshBadge();
      return;
    }
    const batch = writeBatch(db);
    items
      .filter((n) => n.readByAdmin !== true)
      .forEach((n) => {
        batch.update(doc(db, "notifications", n.id), {
          readByAdmin: true,
          readAt: serverTimestamp(),
        });
      });
    await batch.commit();
      setItems((previous) => previous.map((item) => ({ ...item, readByAdmin: true })));
      refreshBadge();
  }

  function iconFor(type) {
    if (type === "announcement" || type === "announcement_published") return Megaphone;
    if (type === "signup" || type === "new_user") return UserPlus;
    return Bell;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>
          <p className="text-sm text-text-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {["all", "unread"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              filter === f
                ? "bg-bg-elevated text-text-primary font-medium"
                : "text-text-secondary hover:bg-bg-panel-alt"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-panel">
        {loading && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">Loading…</div>
        )}
        {!loading && visible.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Bell size={28} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted">No notifications yet.</p>
            <p className="mt-1 text-xs text-text-muted">
              Publish an announcement or wait for new signups.
            </p>
          </div>
        )}
        {visible.map((n) => {
          const Icon = iconFor(n.type);
          return (
            <button
              key={n.id}
              onClick={() => n.readByAdmin !== true && markRead(n.id)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-panel-alt ${
                n.readByAdmin !== true ? "bg-bg-elevated/40" : ""
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {n.title || "Notification"}
                  </p>
                  {n.readByAdmin !== true && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </div>
                {n.body && (
                  <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {n.createdAt?.seconds
                    ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                    : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}