import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "./BackButton";
import { Search, Bell, Moon, Sun, LogOut } from "lucide-react";
import UniqueIdBadge from "./UniqueIdBadge";
import ConfirmModal from "./ConfirmModal";
import UserAvatar from "./UserAvatar";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function UserTopbar({ profile, unreadCount, search, onSearchChange }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { logout } = useAuth();
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
  const officialName = profile?.name || "";
  const initials = (profile?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light bg-card-light px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <BackButton className="border-border-light text-ink-muted hover:bg-surface-light hover:text-ink" />
        <div>
          <h1 className="text-base font-semibold text-ink sm:text-lg">
            {getGreeting()}, {firstName}
          </h1>
          {officialName && (profile?.nickname || profile?.nickName) && (
            <p className="text-[11px] text-ink-muted leading-tight">{officialName}</p>
          )}
        </div>
        <UniqueIdBadge uniqueId={profile?.uniqueId} />
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Search */}
        <div className="hidden items-center gap-2 rounded-lg border border-border-light bg-surface-light px-3 py-2 sm:flex">
          <Search size={16} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search"
            className="w-40 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-light text-ink-muted transition hover:bg-surface-light hover:text-ink"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notification bell — opens Notifications page */}
        <button
          type="button"
          onClick={() => navigate("/dashboard/notifications")}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-light hover:text-ink"
          aria-label="Notifications"
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-danger text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar with popup */}
        <UserAvatar profile={profile} size={36} />

        {/* Logout */}
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          disabled={loggingOut}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border-light px-2.5 text-ink-muted transition hover:border-status-danger/40 hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-60"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={16} />
          <span className="hidden text-xs font-medium sm:inline">Log out</span>
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
