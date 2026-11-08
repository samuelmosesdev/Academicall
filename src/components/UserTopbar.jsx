import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "./BackButton";
import { Search, Bell, Moon, Sun, LogOut, Menu } from "lucide-react";
import UniqueIdBadge from "./UniqueIdBadge";
import ConfirmModal from "./ConfirmModal";
import UserAvatar from "./UserAvatar";
import GlobalSearch from "./search/GlobalSearch";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useStudentNotifications } from "../hooks/useStudentNotifications";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function UserTopbar({ profile, unreadCount: unreadProp, onMenu }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { logout, authMode } = useAuth();
  // Same shared store the notifications page reads, so the badge counts exactly
  // what the page shows as unread (system notifications + announcements) and
  // drops the moment something is opened or marked read.
  const { unreadCount: liveUnread, loading: notifLoading } = useStudentNotifications();
  const unreadCount = authMode === "api" && !notifLoading ? liveUnread : unreadProp || 0;
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  const firstName = profile?.nickname || profile?.nickName || profile?.name?.split(" ")[0] || "there";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const iconBtn =
    "relative flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-card-light text-ink-muted transition hover:border-border-strong hover:text-ink";

  return (
    <header className="topbar-paper sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-light px-4 py-3 sm:px-8 lg:px-10 lg:py-4">
      <div className="flex min-w-0 items-center gap-3">
        {onMenu && (
          <button type="button" onClick={onMenu} aria-label="Open menu" className={`${iconBtn} shrink-0 lg:hidden`}>
            <Menu size={18} />
          </button>
        )}
        <span className="hidden sm:block">
          <BackButton className="border-border-light text-ink-muted hover:bg-surface-light hover:text-ink" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow hidden text-ink-muted sm:block">{today}</p>
          <p className="truncate font-display text-[1.15rem] font-[420] tracking-[-0.02em] text-ink sm:text-[1.4rem]">
            {getGreeting()}, <span className="serif-i">{firstName}</span>
          </p>
        </div>
        <div className="hidden xl:block">
          <UniqueIdBadge uniqueId={profile?.uniqueId} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <GlobalSearch />
        <button type="button" onClick={() => navigate("/dashboard/search")} className={`${iconBtn} md:hidden`} aria-label="Search">
          <Search size={17} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className={`${iconBtn} hidden sm:flex`}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button type="button" onClick={() => navigate("/dashboard/notifications")} className={iconBtn} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}>
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg-app bg-lemon px-1 text-[0.7rem] font-semibold text-midnight">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <UserAvatar profile={profile} size={40} />

        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          disabled={loggingOut}
          className={`${iconBtn} hidden hover:!border-status-danger/40 hover:!text-status-danger sm:flex`}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>

      <ConfirmModal
        open={confirmLogout}
        title="Sign out?"
        message="Are you sure you want to sign out of your account? You can log back in anytime."
        confirmLabel={loggingOut ? "Signing out…" : "Yes, sign out"}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </header>
  );
}
