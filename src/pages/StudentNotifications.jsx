import { useState } from "react";
import { Bell, Megaphone, CheckCheck, X } from "lucide-react";
import { useStudentNotifications } from "../hooks/useStudentNotifications";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";

function timeAgo(ts) {
  if (!ts) return "";
  const ms = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StudentNotifications() {
  const { profile } = useAuth();
  const {
    feed,
    loading,
    unreadCount,
    markAnnouncementRead,
    markSystemRead,
    markAllRead,
  } = useStudentNotifications();

  const [selected, setSelected] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  async function handleTap(item) {
    // Mark as read
    if (item._type === "announcement") {
      await markAnnouncementRead(item.id);
    } else {
      await markSystemRead(item.id);
    }
    // Open detail popup
    setSelected(item);
  }

  async function handleArchive(item, toArchive = true) {
    try {
      await notificationsApi.update(item.id, { archived: toArchive === true });
    } catch (e) {
      /* ignore */
    }
  }

  async function handleDelete(item) {
    if (!window.confirm("Move this notification to Trash?")) return;
    try {
      await notificationsApi.update(item.id, { deleted: true });
      if (selected?.id === item.id) setSelected(null);
    } catch (e) {
      alert(e.message || "Could not delete");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-ink-muted">
            Announcements and updates
            {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink transition hover:border-teal hover:text-teal"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-sm text-ink-muted">Loading notifications…</p>
      )}

      {/* Empty state */}
      {!loading && feed.length === 0 && (
        <div className="rounded-xl border border-border-light bg-card-light px-4 py-12 text-center text-sm text-ink-muted">
          <Bell className="mx-auto mb-2 opacity-50" size={28} />
          No notifications yet. Check back after admin posts an announcement.
        </div>
      )}

      {/* Notification list */}
      <div className="flex items-center justify-between">
        <div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <span className="text-xs text-ink-muted">Show archived</span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {feed
          .filter((it) => (showArchived ? true : !it.archived))
          .map((item) => (
          <button
            key={`${item._type}-${item.id}`}
            type="button"
            onClick={() => handleTap(item)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:border-teal/40 ${
              !item._read
                ? "border-teal/30 bg-teal-soft/20"
                : "border-border-light bg-card-light"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
              <Megaphone size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {!item._read && (
                  <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] font-bold text-teal">
                    NEW
                  </span>
                )}
                <h2 className="text-sm font-semibold text-ink">
                  {item.title || item.message || "Notification"}
                </h2>
              </div>

              <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                {item.body || item.message || ""}
              </p>

              <p className="mt-2 text-xs text-ink-muted">
                {item.createdByName || "Admin"} · {timeAgo(item.createdAt)}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {!item._read && (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" />
              )}
              <div className="flex gap-2">
                {!item.archived ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleArchive(item, true); }} className="text-xs text-ink-muted">Archive</button>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleArchive(item, false); }} className="text-xs text-ink-muted">Unarchive</button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="text-xs text-status-danger">Delete</button>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ========== DETAIL POPUP when student taps a notification ========== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-card-light p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
                  <Megaphone size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    {selected.title || selected.message || "Notification"}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {selected.createdByName || "Admin"} · {timeAgo(selected.createdAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-light hover:text-ink"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
              {selected.body || selected.message || "No extra details."}
            </p>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-lg bg-teal py-2.5 text-sm font-semibold text-white transition hover:bg-teal-dark"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}