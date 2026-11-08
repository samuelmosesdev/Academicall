import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Bell, MessageSquareMore, Sun, Moon, Menu, CornerDownLeft, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import BackButton from "./BackButton";
import { isAdmin, isAlpha } from "../lib/roles";
import { activityApi, usersApi } from "../lib/api";
import { useStaffShell } from "./staff/StaffShellContext";
import { findCurrent, flattenNav } from "./staff/staffNav";

const PEOPLE_TTL_MS = 5 * 60 * 1000;
let peopleCache = { at: 0, agents: [], students: [], logs: [] };

/** People and references are only fetched the first time someone searches (and then cached). */
async function loadPeople() {
  if (Date.now() - peopleCache.at < PEOPLE_TTL_MS) return peopleCache;
  const [users, activity] = await Promise.allSettled([usersApi.list(), activityApi.list()]);
  const list = users.status === "fulfilled" ? users.value.users || [] : [];
  const logs = activity.status === "fulfilled" ? activity.value.activity || activity.value.activities || [] : [];
  peopleCache = {
    at: Date.now(),
    agents: list.filter((u) => ["agent", "alphaAgent"].includes(u.role)),
    students: list.filter((u) => ["user", "courseRep"].includes(u.role)),
    logs,
  };
  return peopleCache;
}

const has = (term, ...fields) => fields.some((f) => String(f || "").toLowerCase().includes(term));

export default function Topbar({ onSearchChange, onMenu }) {
  const { profile } = useAuth();
  const { variant, sections, badges } = useStaffShell();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [people, setPeople] = useState(peopleCache);

  const admin = isAdmin(profile);
  const canSearchPeople = admin || isAlpha(profile);
  const home = variant === "admin" ? "/admin" : "/agent";
  const photo = profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null;
  const initials = (profile?.name || profile?.nickname || "A").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const pages = useMemo(() => flattenNav(sections, variant), [sections, variant]);
  const current = useMemo(() => findCurrent(sections, variant, location.pathname), [sections, variant, location.pathname]);

  function ensurePeople() {
    if (!canSearchPeople) return;
    loadPeople().then(setPeople).catch(() => {});
  }

  // "/" or Ctrl/Cmd+K jumps to search from anywhere (unless you are typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out = [];
    const pageHits = pages.filter((p) => has(term, p.label, p.section)).slice(0, 6)
      .map((p) => ({ key: `page-${p.to}`, label: p.label, sub: p.section, to: p.to }));
    if (pageHits.length) out.push({ title: "Go to", items: pageHits });
    if (canSearchPeople && term.length >= 2) {
      const peopleHits = [
        ...people.agents.filter((a) => has(term, a.name, a.email, a.uniqueId, a.id)).map((a) => ({ key: `a-${a.id}`, label: a.name || a.email, sub: `Agent · ${a.email}`, to: `/admin/agents/${a.id}` })),
        ...people.students.filter((s) => has(term, s.name, s.email, s.uniqueId, s.nickname, s.id)).map((s) => ({ key: `s-${s.id}`, label: s.nickname || s.name || s.email, sub: `Student · ${s.uniqueId || s.email}`, to: `/admin/users?q=${encodeURIComponent(s.uniqueId || s.email || s.name || "")}` })),
      ].slice(0, 6);
      if (peopleHits.length) out.push({ title: "People", items: peopleHits });
      const refHits = people.logs.filter((l) => has(term, l.reference, l.action, l.actorName, l.targetName)).slice(0, 4)
        .map((l) => ({ key: `r-${l.id}`, label: l.reference || l.id, sub: `${l.action} · ${l.actorName || ""}`, to: `/admin/activity-log?ref=${encodeURIComponent(l.reference || l.id)}` }));
      if (refHits.length) out.push({ title: "References", items: refHits });
    }
    return out;
  }, [q, pages, people, canSearchPeople]);
  const flat = groups.flatMap((g) => g.items);

  function go(item) {
    setOpen(false); setQ(""); onSearchChange?.("");
    inputRef.current?.blur();
    navigate(item.to);
  }
  function onInputKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flat[active]) { e.preventDefault(); go(flat[active]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  }

  const iconBtn = "relative flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-bg-panel text-text-secondary transition-colors hover:text-text-primary";
  const badge = (n) => n > 0 && (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg-app bg-lemon px-1 text-[0.7rem] font-semibold text-midnight">{n > 9 ? "9+" : n}</span>
  );
  let idx = -1;

  return (
    <header className="topbar-paper sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-8 lg:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {onMenu && (
          <button type="button" onClick={onMenu} aria-label="Open menu" className={`${iconBtn} shrink-0 lg:hidden`}><Menu size={18} /></button>
        )}
        <span className="hidden sm:block"><BackButton /></span>

        {current && !current.end && (
          <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-1.5 text-sm xl:flex">
            <span className="text-text-muted">{current.section}</span>
            <ChevronRight size={13} className="text-text-muted" />
            <span className="font-medium text-text-primary">{current.label}</span>
          </nav>
        )}

        <div ref={boxRef} className="relative w-full max-w-md xl:ml-3">
          <div className="flex items-center gap-2.5 rounded-full border border-border-subtle bg-bg-panel px-4 py-2.5 focus-within:border-accent">
            <Search size={16} className="text-text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); onSearchChange?.(e.target.value); setOpen(true); setActive(0); }}
              onFocus={() => { setOpen(true); ensurePeople(); }}
              onKeyDown={onInputKey}
              role="combobox"
              aria-expanded={open && flat.length > 0}
              aria-label="Search"
              placeholder={canSearchPeople ? "Search pages, people or refs (ACA-…)" : "Search pages"}
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <kbd className="hidden rounded-md border border-border-subtle px-1.5 py-0.5 font-mono text-[0.65rem] text-text-muted sm:block">/</kbd>
          </div>
          {open && q.trim() && (
            <div className="animate-pop absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border-subtle bg-bg-panel p-1.5 shadow-[var(--shadow-pop)]" role="listbox">
              {flat.length === 0 && <p className="px-3 py-4 text-sm text-text-muted">No matches for “{q.trim()}”.</p>}
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="eyebrow px-3 pb-1 pt-2 text-text-muted">{g.title}</p>
                  {g.items.map((item) => {
                    idx += 1;
                    const mine = idx;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={mine === active}
                        onMouseEnter={() => setActive(mine)}
                        onClick={() => go(item)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${mine === active ? "bg-bg-panel-alt" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-text-primary">{item.label}</span>
                          <span className="block truncate text-xs text-text-muted">{item.sub}</span>
                        </span>
                        {mine === active && <CornerDownLeft size={13} className="shrink-0 text-text-muted" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button type="button" onClick={() => toggleTheme()} className={`${iconBtn} hidden sm:flex`} aria-label="Toggle theme">
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button type="button" onClick={() => navigate(`${home}/staff-chat`)} className={iconBtn} aria-label="Staff HQ messages" title="Staff HQ">
          <MessageSquareMore size={17} />{badge(badges.staffChat)}
        </button>
        {admin && (
          <button type="button" onClick={() => navigate("/admin/notifications")} className={iconBtn} aria-label="Notifications" title="Notifications">
            <Bell size={17} />{badge(badges.inbox)}
          </button>
        )}
        <button type="button" onClick={() => navigate(`${home}/profile`)} className="p-0" aria-label="Your profile">
          {photo ? (
            <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-midnight text-xs font-semibold text-lemon dark:bg-lemon dark:text-midnight">{initials}</div>
          )}
        </button>
      </div>
    </header>
  );
}
