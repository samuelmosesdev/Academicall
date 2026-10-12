import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ConfirmModal from "./ConfirmModal";

export default function SidebarFooter({ onNavigate }) {
  const { logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function switchTheme(next) {
    if ((next === "dark") === isDark) return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    setTheme(next);
    window.setTimeout(() => root.classList.remove("theme-switching"), 450);
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      setConfirmOpen(false);
      onNavigate?.();
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sidebar-footer mt-6 space-y-2 px-1 pt-4">
      <div className="theme-switch" role="group" aria-label="Theme">
        <button type="button" aria-pressed={!isDark} onClick={() => switchTheme("light")}>
          <Sun size={14} /> Light
        </button>
        <button type="button" aria-pressed={isDark} onClick={() => switchTheme("dark")}>
          <Moon size={14} /> Dark
        </button>
      </div>

      <button type="button" className="sidebar-logout" onClick={() => setConfirmOpen(true)} disabled={busy}>
        <LogOut size={17} strokeWidth={1.7} />
        <span>{busy ? "Signing out…" : "Log out"}</span>
      </button>

      <ConfirmModal
        open={confirmOpen}
        title="Sign out?"
        message="You'll need your email and password to sign back in."
        confirmLabel={busy ? "Signing out…" : "Yes, sign out"}
        cancelLabel="Stay signed in"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
