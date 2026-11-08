import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Bell, CheckCheck, Megaphone, Trash2 } from "lucide-react";
import { useStudentNotifications, toMillis } from "../hooks/useStudentNotifications";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../lib/api";
import { SkeletonCards } from "../components/ui/Skeleton";

function timeAgo(ts) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function StudentNotifications() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    feed,
    loading,
    unreadCount,
    markAnnouncementRead,
    markSystemRead,
    markAllRead,
    removeLocal,
  } = useStudentNotifications();

  const [filter, setFilter] = useState("all"); // all | unread

  const visible = useMemo(
    () => (filter === "unread" ? feed.filter((item) => !item._read) : feed),
    [feed, filter]
  );

  function handleTap(item) {
    // Mark read (optimistic inside the hook) without holding up navigation;
    // a failed request is re-synced from the server on the next refresh.
    const mark = item._type === "announcement" ? markAnnouncementRead(item.id) : markSystemRead(item.id);
    Promise.resolve(mark).catch(() => {});
    const link = item.data?.link || item.link;
    if (link && link.startsWith("/")) navigate(link);
    else navigate(profile?.role === "aspirant" ? "/dashboard/house" : "/dashboard/department");
  }

  async function handleArchive(item) {
    removeLocal(item.id);
    try {
      await notificationsApi.update(item.id, { archived: true });
    } catch {
      /* the next refresh brings it back if this failed */
    }
  }

  async function handleDelete(item) {
    if (!window.confirm("Move this notification to Trash?")) return;
    removeLocal(item.id);
    try {
      await notificationsApi.update(item.id, { deleted: true });
    } catch (e) {
      alert(e.message || "Could not delete");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-ink-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/notifications/archived"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-border-strong hover:text-ink"
          >
            <Archive size={14} />
            Archived
          </Link>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead().catch(() => {})}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink transition hover:border-teal hover:text-teal"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5" role="tablist" aria-label="Filter notifications">
        {[
          ["all", "All"],
          ["unread", unreadCount > 0 ? `Unread · ${unreadCount}` : "Unread"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === key
                ? "bg-ink text-bg-app"
                : "border border-border-light text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <SkeletonCards count={4} label="Loading notifications…" />}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-border-light bg-card-light px-4 py-12 text-center text-sm text-ink-muted">
          <Bell className="mx-auto mb-2 opacity-50" size={28} />
          {filter === "unread" && feed.length > 0
            ? "Nothing unread. You've seen everything."
            : "No notifications yet. Announcements and updates will show up here."}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="space-y-2.5">
          {visible.map((item) => {
            const unread = !item._read;
            return (
              <li
                key={`${item._type}-${item.id}`}
                className={`group relative flex items-start gap-3 rounded-2xl border p-4 transition hover:border-teal/40 ${
                  unread ? "border-teal/30 bg-teal-soft/20" : "border-border-light bg-card-light"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    unread ? "bg-teal-soft text-teal" : "bg-surface-light text-ink-muted"
                  }`}
                >
                  {item._type === "announcement" ? <Megaphone size={18} /> : <Bell size={18} />}
                </span>

                <button
                  type="button"
                  onClick={() => handleTap(item)}
                  className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:rounded-2xl after:content-['']"
                >
                  <span className="flex items-start gap-2">
                    <span
                      className={`text-sm text-ink ${unread ? "font-semibold" : "font-medium"}`}
                    >
                      {item.title || item.message || "Notification"}
                    </span>
                    {unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="Unread" />
                    )}
                  </span>
                  {(item.body || item.message) && (
                    <span className="mt-1 line-clamp-2 block text-sm text-ink-muted">
                      {item.body || item.message}
                    </span>
                  )}
                  <span className="mt-2 block text-xs text-ink-muted">
                    {item._type === "announcement" ? `${item.createdByName || "Announcement"} · ` : ""}
                    {timeAgo(item.createdAt)}
                  </span>
                </button>

                {item._type === "system" && (
                  <div className="relative z-10 flex shrink-0 gap-1 self-center">
                    <button
                      type="button"
                      onClick={() => handleArchive(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-light hover:text-ink"
                      aria-label="Archive"
                      title="Archive"
                    >
                      <Archive size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-status-danger/10 hover:text-status-danger"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
