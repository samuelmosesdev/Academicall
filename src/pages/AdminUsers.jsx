import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, ChevronRight, Download, KeyRound, Newspaper, Feather, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { directoryApi, usersApi } from "../lib/api";
import { appConfirm, notify } from "../lib/dialogs";
import { can, roleOf, ROLE_LABELS } from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { PageHeader, ErrorState, EmptyState, SearchField, SortTh, Pager, SkeletonRows } from "../components/ui";

/**
 * Users: the staff directory. Server-side search, filters, sorting and
 * pagination (GET /users?page=…). Opening a row goes to the full profile,
 * where the sensitive actions live behind their own permissions.
 */
const GROUPS = [
  { id: "students", label: "Students" },
  { id: "courseReps", label: "Course Reps" },
  { id: "news", label: "News" },
  { id: "secretaries", label: "Secretaries" },
  { id: "agents", label: "Agents" },
  { id: "admins", label: "Admins" },
  { id: "all", label: "Everyone" },
];
const RANK = { admin: 4, alphaAgent: 3, agent: 2 };
const rank = (r) => RANK[r] || 1;

function timeAgo(d) {
  if (!d) return "Never";
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ u }) {
  return u.photoUrl
    ? <img src={u.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
    : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-sm font-semibold text-accent">{(u.name || u.email || "?").charAt(0).toUpperCase()}</span>;
}

export default function AdminUsers() {
  const { user: me, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const base = location.pathname.startsWith("/agent") ? "/agent" : "/admin";
  const [params, setParams] = useState({ group: "students", page: 1, pageSize: 25, sort: "createdAt", dir: "desc", q: "", status: "", plan: "", level: "", department: "" });
  const [data, setData] = useState({ users: [], total: 0, counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  // Old links (?uid=…) open the profile straight away.
  useEffect(() => {
    const uid = new URLSearchParams(location.search).get("uid");
    if (uid) navigate(`${base}/users/${uid}`, { replace: true });
  }, [location.search, base, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await directoryApi.list(params));
    } catch (err) {
      setError(err.message || "Couldn't load users");
    } finally {
      setLoading(false);
    }
  }, [params]);
  useEffect(() => { load(); }, [load]);
  const set = (patch) => setParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  const sort = { key: params.sort, dir: params.dir };
  const onSort = (s) => set({ sort: s.key, dir: s.dir });

  const canSuspend = can(profile, "users.suspend");
  const myRank = rank(roleOf(profile));

  async function toggleSuspend(u) {
    const suspend = u.status !== "suspended";
    const ok = await appConfirm(
      suspend
        ? `Suspend ${u.name || u.email}? They're signed out and can't sign in until you reactivate them. Their data stays.`
        : `Reactivate ${u.name || u.email}? They can sign in again straight away.`,
      { tone: suspend ? "danger" : undefined, confirmLabel: suspend ? "Suspend" : "Reactivate" },
    );
    if (!ok) return;
    setBusy(u.id);
    try {
      await usersApi.update(u.id, { status: suspend ? "suspended" : "active" });
      logActivity({ actorUid: me?.uid, actorName: profile?.name || me?.email, action: suspend ? "user.suspend" : "user.reactivate", targetUid: u.id, targetName: u.name || u.email }).catch(() => {});
      notify.success(suspend ? "Account suspended" : "Account reactivated");
      load();
    } catch (err) {
      notify.error(err.message || "Couldn't change their status");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const rows = [["Name", "Email", "Academicall ID", "Role", "Institution", "Department", "Level", "Plan", "Status", "Joined", "Last active"]];
    for (const u of data.users) rows.push([u.name, u.email, u.uniqueId, ROLE_LABELS[u.role] || u.role, u.institution?.displayName || u.institution?.name, u.department, u.level, u.plan, u.status, u.createdAt?.slice(0, 10), u.lastActiveAt?.slice(0, 10)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `academicall-users-${params.group}-p${params.page}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Everyone on Academicall. Open a person to manage their role, duties, password and sessions."
        actions={<button type="button" className="acx-btn-ghost" onClick={exportCsv} disabled={!data.users.length}><Download size={14} /> Export this page</button>}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Groups">
        {GROUPS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={params.group === g.id} className={`acx-filter ${params.group === g.id ? "is-on" : ""}`} onClick={() => set({ group: g.id })}>
            {g.label} <span>{(data.counts?.[g.id] ?? 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={params.q} onChange={(q) => set({ q })} placeholder="Name, email, ID or matric number" className="w-full sm:w-auto sm:min-w-[17rem] sm:flex-1 lg:max-w-sm" />
        <div className="w-full sm:w-48"><input className="acx-input" placeholder="Department" value={params.department} onChange={(e) => set({ department: e.target.value })} aria-label="Department" /></div>
        <select className="acx-select" value={params.level} onChange={(e) => set({ level: e.target.value })} aria-label="Level">
          <option value="">All levels</option>{["100", "200", "300", "400", "500", "600", "ND", "HND", "NCE"].map((l) => <option key={l} value={l}>{/^\d/.test(l) ? `${l} Level` : l}</option>)}
        </select>
        <select className="acx-select" value={params.plan} onChange={(e) => set({ plan: e.target.value })} aria-label="Plan">
          <option value="">Any plan</option><option value="free">Free</option><option value="pro">Pro</option><option value="annual">Annual</option>
        </select>
        <div className="acx-seg">
          {[["", "Any status"], ["active", "Active"], ["suspended", "Suspended"]].map(([v, l]) => <button key={l} type="button" className={params.status === v ? "is-on" : ""} onClick={() => set({ status: v })}>{l}</button>)}
        </div>
      </div>

      {error ? <ErrorState title="Users didn't load" message={error} onRetry={load} /> : (
        <div className="acx-table-wrap">
          <table className="acx-table">
            <thead>
              <tr>
                <SortTh k="name" sort={sort} onSort={onSort}>Person</SortTh>
                <th>Role</th>
                <th className="hidden lg:table-cell">Institution · department</th>
                <SortTh k="level" sort={sort} onSort={onSort} className="hidden md:table-cell">Level</SortTh>
                <th>Status</th>
                <SortTh k="lastActiveAt" sort={sort} onSort={onSort} className="hidden md:table-cell">Last active</SortTh>
                <SortTh k="createdAt" sort={sort} onSort={onSort} className="hidden xl:table-cell">Joined</SortTh>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={8} rows={8} /> : data.users.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Users} title="Nobody matches" description="Try another group, or clear the search and filters." className="!border-0 !py-12" /></td></tr>
              ) : data.users.map((u) => {
                const suspended = u.status === "suspended";
                const manageable = rank(u.role) < myRank && u.id !== me?.uid;
                return (
                  <tr key={u.id} className={`cursor-pointer ${suspended ? "is-muted" : ""}`} onClick={() => navigate(`${base}/users/${u.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`${base}/users/${u.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-text-primary">{u.name || "No name yet"}</div>
                          <div className="truncate text-xs text-text-muted">{u.email}{u.uniqueId ? ` · ${u.uniqueId}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <span className={`acx-chip-sm ${u.role === "admin" ? "is-danger" : u.role === "alphaAgent" || u.role === "agent" ? "is-lemon" : u.role === "courseRep" ? "is-aqua" : ""}`}>{ROLE_LABELS[u.role] || "Student"}</span>
                        {(u.staffTags || []).includes("news") && <span className="acx-chip-sm" title="News duty"><Newspaper size={10} /> News</span>}
                        {(u.staffTags || []).includes("secretary") && <span className="acx-chip-sm" title="Secretary duty"><Feather size={10} /> Sec.</span>}
                        {u.plan && u.plan !== "free" && <span className="acx-chip-sm is-aqua">{u.plan === "annual" ? "Annual" : "Pro"}</span>}
                      </div>
                    </td>
                    <td className="hidden max-w-[18rem] lg:table-cell">
                      <span className="block truncate text-text-primary">{u.institution?.displayName || u.institution?.abbreviation || u.institution?.name || "—"}</span>
                      <span className="block truncate text-xs">{u.department || "No department"}</span>
                    </td>
                    <td className="hidden whitespace-nowrap md:table-cell">{u.level || "—"}</td>
                    <td>
                      <span className={`acx-chip-sm ${suspended ? "is-danger" : "is-aqua"}`}>{suspended ? "Suspended" : u.status === "pending" ? "Pending" : "Active"}</span>
                      {u.mustChangePassword && <KeyRound size={12} className="ml-1 inline text-text-muted" aria-label="Must change password" />}
                    </td>
                    <td className="hidden whitespace-nowrap md:table-cell">{timeAgo(u.lastActiveAt)}</td>
                    <td className="hidden whitespace-nowrap xl:table-cell">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canSuspend && manageable && (
                          <button type="button" className={`acx-icon-btn ${suspended ? "is-good" : "is-danger"}`} disabled={busy === u.id} onClick={() => toggleSuspend(u)} aria-label={suspended ? `Reactivate ${u.name || u.email}` : `Suspend ${u.name || u.email}`} title={suspended ? "Reactivate" : "Suspend"}>
                            {suspended ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          </button>
                        )}
                        <Link to={`${base}/users/${u.id}`} className="acx-icon-btn" aria-label={`Open ${u.name || u.email}`} title="Open profile"><ChevronRight size={14} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={params.page} pageSize={params.pageSize} total={data.total} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })} />
    </div>
  );
}
