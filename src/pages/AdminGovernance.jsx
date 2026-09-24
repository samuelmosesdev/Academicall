import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usersApi } from "../lib/api";
import { ROLE_LABELS } from "../lib/roles";

export default function AdminGovernance() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.list().then((response) => setUsers(response.users || [])).catch(() => setUsers([])).finally(() => setLoading(false));
  }, []);

  const courseReps = useMemo(() => users.filter((user) => user.role === "courseRep"), [users]);
  const agents = useMemo(() => users.filter((user) => user.role === "agent" || user.role === "alphaAgent"), [users]);
  const suspended = useMemo(() => users.filter((user) => user.status === "suspended"), [users]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-lg font-semibold text-text-primary">Governance</h1><p className="text-sm text-text-muted">Roles, Course Reps, agents, and suspended accounts.</p></div>
      <Link
        to="/admin/governance/academic-catalog"
        className="flex items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-4 transition hover:border-accent/60 hover:bg-accent-soft/70"
      >
        <div>
          <p className="text-sm font-semibold text-text-primary">Academic catalog</p>
          <p className="mt-1 text-xs text-text-muted">Add or update faculties, departments, and programs used for student profiles and Course Rep assignments.</p>
        </div>
        <span className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-app">Manage catalog</span>
      </Link>
      <div className="grid gap-3 sm:grid-cols-3">{[[courseReps.length, "Course Reps", "text-accent"], [agents.length, "Agents", "text-text-primary"], [suspended.length, "Suspended", "text-red-400"]].map(([value, label, color]) => <div key={label} className="rounded-xl border border-border-subtle bg-bg-panel p-4"><div className={`text-2xl font-bold ${color}`}>{value}</div><div className="text-xs text-text-muted">{label}</div></div>)}</div>
      <section><h2 className="mb-2 text-sm font-semibold text-text-primary">Course Reps by scope</h2>{loading && <p className="text-sm text-text-muted">Loading…</p>}<div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">{courseReps.map((user) => { const meta = user.courseRepMeta || {}; return <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><div className="text-sm font-medium text-text-primary">{user.name || user.email}</div><div className="text-xs text-text-muted">{[meta.faculty || user.faculty, meta.department || user.department, meta.level || user.level].filter(Boolean).join(" · ") || "No scope set"}</div></div><Link to={`/admin/users/${user.id}`} className="text-xs font-medium text-accent hover:underline">Manage</Link></div>; })}{!loading && courseReps.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-muted">No Course Reps assigned yet.</p>}</div></section>
      <section><h2 className="mb-2 text-sm font-semibold text-text-primary">Agents</h2><div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">{agents.map((user) => <div key={user.id} className="flex items-center justify-between px-4 py-3 text-sm"><div><span className="font-medium text-text-primary">{user.name || user.email}</span><span className="ml-2 text-xs text-text-muted">{ROLE_LABELS[user.role] || user.role}</span></div><Link to={`/admin/users/${user.id}`} className="text-xs text-accent hover:underline">Manage</Link></div>)}{!loading && agents.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-muted">No agents yet.</p>}</div></section>
    </div>
  );
}
