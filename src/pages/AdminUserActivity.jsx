import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Filter, Shield, Undo2 } from "lucide-react";
import { usersApi, activityApi } from "../lib/api";
import { ROLE_LABELS } from "../lib/roles";

const typeFilters = [
  ["all", "All Types", ""],
  ["role", "Role Changes", "role"],
  ["security", "Security", "password|login|force_password"],
  ["user", "User Status", "suspend|reactivate|delete"],
  ["agent", "Agent Actions", "agent"],
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function AdminUserActivity() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("7d");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [userResponse, activityResponse] = await Promise.all([
        usersApi.get(userId),
        activityApi.list(`userId=${encodeURIComponent(userId)}&limit=150`),
      ]);
      setUser(userResponse.user || userResponse);
      setActivities(activityResponse.activities || activityResponse.activity || activityResponse || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(() => setActivities([])); }, [userId]);

  const filtered = useMemo(() => {
    let result = activities;
    if (dateFilter === "today") result = result.filter((item) => item.createdAt && new Date(item.createdAt) >= startOfToday());
    if (dateFilter === "7d") result = result.filter((item) => item.createdAt && new Date(item.createdAt) >= daysAgo(7));
    const match = typeFilters.find(([id]) => id === typeFilter)?.[2];
    if (match) result = result.filter((item) => new RegExp(match, "i").test(item.action || ""));
    return result;
  }, [activities, dateFilter, typeFilter]);

  async function revert() {
    if (!pending) return;
    setBusy(true);
    try {
      await activityApi.revert(pending.id);
      setPending(null);
      await load();
    } catch (error) {
      window.alert(error.message || "Revert failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `activity-${userId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading activity…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Link to={`/admin/users/${userId}`} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent"><ArrowLeft size={16} /> Back to profile</Link>
      <section className="rounded-xl border border-border-subtle bg-bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent"><Shield size={20} /></span><div><h1 className="text-lg font-semibold text-text-primary">{user?.name || user?.email || "User"}</h1><p className="text-xs text-text-muted">{user?.email} · {ROLE_LABELS[user?.role] || user?.role || "User"}</p></div></div>
          <button type="button" onClick={exportLog} className="inline-flex items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-2 text-xs font-medium text-text-primary"><Download size={14} /> Export</button>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2"><Filter size={14} className="text-accent" />{[["all", "All Time"], ["today", "Today"], ["7d", "Last 7 Days"]].map(([id, label]) => <button key={id} type="button" onClick={() => setDateFilter(id)} className={`rounded-full px-3 py-1 text-xs ${dateFilter === id ? "bg-accent text-bg-app" : "bg-bg-elevated text-text-muted"}`}>{label}</button>)}<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="ml-auto rounded-lg border border-border-subtle bg-bg-elevated px-2 py-1.5 text-xs text-text-primary">{typeFilters.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
        <div className="text-xs text-text-muted">Showing <strong className="text-accent">{filtered.length}</strong> events</div>
      </section>
      {pending && <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"><p className="text-sm font-semibold text-text-primary">Revert “{pending.action}”?</p><p className="mt-1 text-xs text-text-muted">This applies the recorded inverse action.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={revert} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Undo2 size={14} /> Confirm Undo</button><button type="button" onClick={() => setPending(null)} className="rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-muted">Cancel</button></div></section>}
      <section className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">{filtered.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4"><div><div className="flex items-center gap-2"><span className="rounded bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-primary">{item.action}</span>{item.reversed && <span className="text-xs text-red-400">Reversed</span>}</div><p className="mt-1 text-sm text-text-primary">{item.actorName || "System"}{item.targetName ? ` → ${item.targetName}` : ""}</p><p className="mt-1 max-w-xl break-all font-mono text-[10px] text-text-muted">{item.meta ? JSON.stringify(item.meta) : ""}</p></div><div className="flex shrink-0 flex-col items-end gap-2 text-xs text-text-muted"><span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</span>{item.reversible && <button type="button" onClick={() => setPending(item)} className="inline-flex items-center gap-1 text-red-400 hover:underline"><Undo2 size={13} /> Undo</button>}</div></div>)}{filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-muted">No activity for these filters.</p>}</section>
    </div>
  );
}
