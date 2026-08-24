import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Bell,
  MessageSquareMore,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { useStaffChatUnread } from "../hooks/useStaffChatUnread";
import { useTheme } from "../context/ThemeContext";
import { db } from "../firebase/config";
import BackButton from "./BackButton";
import { isAdmin, isAlpha, isStaff } from "../lib/roles";

export default function Topbar({ search, onSearchChange }) {
  const { profile, user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { unread: staffUnread } = useStaffChatUnread();
  const { theme, toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState(search || "");
  const [hits, setHits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [students, setStudents] = useState([]);

  const canSearchPeople = isAdmin(profile) || isAlpha(profile);
  const staffChatPath = profile?.role === "admin" ? "/admin/staff-chat" : "/agent/staff-chat";
  const photo = profile?.photoURL || profile?.avatarUrl || null;
  const initials = (profile?.name || profile?.nickname || "A")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Load recent activity refs for global search (admin/alpha)
  useEffect(() => {
    if (!canSearchPeople) return;
    const unsub = onSnapshot(
      query(collection(db, "activityLog"), orderBy("createdAt", "desc"), limit(120)),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLogs([])
    );
    return unsub;
  }, [canSearchPeople]);

  useEffect(() => {
    if (!canSearchPeople) return;
    const unsubA = onSnapshot(
      query(
        collection(db, "users"),
        where("role", "in", ["agent", "alphaAgent"]),
        limit(100)
      ),
      (snap) => setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setAgents([])
    );
    const unsubS = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["user", "courseRep"]), limit(80)),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setStudents([])
    );
    return () => {
      unsubA();
      unsubS();
    };
  }, [canSearchPeople]);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    onSearchChange?.(q);
    if (!canSearchPeople || term.length < 2) {
      setHits([]);
      return;
    }
    const out = [];
    agents.forEach((a) => {
      if (
        [a.name, a.email, a.uniqueId, a.id].some((f) =>
          String(f || "").toLowerCase().includes(term)
        )
      ) {
        out.push({
          type: "agent",
          label: a.name || a.email,
          sub: a.email,
          to: `/admin/agents/${a.id}`,
        });
      }
    });
    students.forEach((s) => {
      if (
        [s.name, s.email, s.uniqueId, s.nickname, s.id].some((f) =>
          String(f || "").toLowerCase().includes(term)
        )
      ) {
        out.push({
          type: "student",
          label: s.nickname || s.name || s.email,
          sub: s.uniqueId || s.email,
          to: `/admin/users?q=${encodeURIComponent(s.uniqueId || s.email || s.name || "")}`,
        });
      }
    });
    logs.forEach((l) => {
      if (
        [l.reference, l.action, l.actorName, l.targetName].some((f) =>
          String(f || "").toLowerCase().includes(term)
        )
      ) {
        out.push({
          type: "ref",
          label: l.reference || l.id,
          sub: `${l.action} · ${l.actorName || ""}`,
          to: `/admin/activity-log?ref=${encodeURIComponent(l.reference || l.id)}`,
        });
      }
    });
    setHits(out.slice(0, 12));
  }, [q, agents, students, logs, canSearchPeople, onSearchChange]);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  const profilePath =
    profile?.role === "admin" ? "/admin/profile" : "/agent/profile";

  return (
    <header className="relative flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-app px-4 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BackButton />
        <div className="relative w-full max-w-md">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2">
            <Search size={16} className="text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                canSearchPeople
                  ? "Search name, ID, or ref (ACA-…)"
                  : "Search"
              }
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
          {hits.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-bg-panel py-1 shadow-xl">
              {hits.map((h, i) => (
                <button
                  key={`${h.type}-${h.label}-${i}`}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-bg-panel-alt"
                  onClick={() => {
                    setHits([]);
                    setQ("");
                    navigate(h.to);
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {h.type}
                  </span>
                  <span className="text-sm text-text-primary">{h.label}</span>
                  <span className="text-[11px] text-text-muted">{h.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => toggleTheme()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle text-text-secondary hover:bg-bg-panel-alt"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Staff HQ messages */}
        <button
          type="button"
          onClick={() => navigate(staffChatPath)}
          className="relative text-text-secondary hover:text-text-primary"
          aria-label="Staff HQ messages"
          title="Staff HQ"
        >
          <MessageSquareMore size={19} />
          {staffUnread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-status-danger px-0.5 text-[10px] font-semibold text-white">
              {staffUnread > 9 ? "9+" : staffUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          className="relative text-text-secondary hover:text-text-primary"
          aria-label="Notifications"
          onClick={() =>
            navigate(profile?.role === "admin" ? "/admin" : "/agent")
          }
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-danger text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <button type="button" onClick={() => navigate(profilePath)} className="p-0">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-2 ring-border-subtle"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent ring-2 ring-border-subtle">
              {initials}
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:bg-bg-panel-alt hover:text-status-danger sm:inline-flex"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </header>
  );
}
