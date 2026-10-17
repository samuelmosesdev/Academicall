import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, UserPlus, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../components/ui";
import AccessEditor, { useAccessCatalog } from "../components/access/AccessEditor";
import { accessApi, timeAgo } from "../lib/staffApi";
import { api, usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, DUTY_LABELS } from "../lib/roles";

const FILTERS = [
  { id: "all", label: "Everyone", test: () => true },
  { id: "alphaAgent", label: "Alpha Agents", test: (p) => p.role === "alphaAgent" },
  { id: "agent", label: "Agents", test: (p) => p.role === "agent" },
  { id: "news", label: "News", test: (p) => (p.staffTags || []).includes("news") },
  { id: "secretary", label: "Secretaries", test: (p) => (p.staffTags || []).includes("secretary") },
  { id: "admin", label: "Admins", test: (p) => p.role === "admin" },
];

function Avatar({ person, size = 36 }) {
  const src = person.photoUrl;
  return src
    ? <img src={src} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
    : <span className="flex shrink-0 items-center justify-center rounded-xl bg-violet-soft font-semibold text-accent" style={{ width: size, height: size }}>{(person.name || person.email || "?").charAt(0).toUpperCase()}</span>;
}

export default function AdminStaffAccess() {
  const { profile } = useAuth();
  const location = useLocation();
  const base = location.pathname.startsWith("/agent") ? "/agent" : "/admin";
  const catalog = useAccessCatalog();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [finder, setFinder] = useState("");
  const [found, setFound] = useState([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const { people: list } = await accessApi.staff();
      setPeople(list);
      setSelected((cur) => (cur ? list.find((p) => p.id === cur.id) || cur : list.find((p) => p.role !== "admin") || list[0] || null));
    } catch (err) {
      setError(err.message || "Couldn't load staff");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (finder.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => {
      api(`/users?q=${encodeURIComponent(finder.trim())}&limit=8`).then((r) => setFound(r.users || [])).catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [finder]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, people.filter(f.test).length])), [people]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) || FILTERS[0];
    const needle = q.trim().toLowerCase();
    return people.filter(f.test).filter((p) => !needle || `${p.name} ${p.email}`.toLowerCase().includes(needle));
  }, [people, filter, q]);

  async function pickFound(u) {
    setFinder("");
    setFound([]);
    try {
      const { user } = await usersApi.get(u.id);
      setSelected(user);
    } catch { /* ignore */ }
  }

  function onSaved(next) {
    setSelected((cur) => ({ ...cur, ...next }));
    load();
  }

  if (loading) return <LoadingState message="Loading staff access…" />;
  if (error) return <ErrorState title="Staff access unavailable" message={error} onRetry={load} />;

  const staffRows = catalog?.capabilities?.filter((c) => c.scope === "staff") || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Staff access"
        description="Choose what each agent can do, and who holds the News and Secretary duties. Admins always keep full control."
        actions={<Link to={`${base}/agents`} className="acx-btn"><UserPlus size={15} /> Add an agent</Link>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Alpha Agents", counts.alphaAgent, "Elevated staff"],
          ["Agents", counts.agent, "Content & support"],
          ["News Agents", counts.news, "Write Academicall News"],
          ["Secretaries", counts.secretary, "Run the Secretariat"],
        ].map(([label, n, hint]) => (
          <div key={label} className="acx-stat"><p className="acx-stat-n">{n}</p><p className="acx-stat-l">{label}</p><p className="acx-stat-h">{hint}</p></div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="acx-card !p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={finder} onChange={(e) => setFinder(e.target.value)} placeholder="Give a duty to any user…" className="acx-input pl-9" />
            </div>
            {found.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {found.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => pickFound(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-bg-hover">
                      <Avatar person={u} size={28} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name || u.email}</span><span className="block truncate text-xs text-text-muted">{ROLE_LABELS[u.role] || u.role} · {u.email}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`acx-filter ${filter === f.id ? "is-on" : ""}`}>{f.label} <span>{counts[f.id]}</span></button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or email" className="acx-input" />

          <ul className="acx-card !p-1.5">
            {shown.length === 0 && <li className="p-4 text-sm text-text-muted">Nobody here yet.</li>}
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelected(p)} className={`acx-person ${selected?.id === p.id ? "is-on" : ""}`}>
                  <Avatar person={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text-primary">{p.name || p.email}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                      <span className="acx-chip-sm">{ROLE_LABELS[p.role] || p.role}</span>
                      {(p.staffTags || []).map((t) => <span key={t} className="acx-chip-sm is-aqua">{DUTY_LABELS[t] || t}</span>)}
                      {p.status === "suspended" && <span className="acx-chip-sm is-danger">suspended</span>}
                    </span>
                  </span>
                  <span className="text-right text-xs leading-tight text-text-muted">
                    {p.role === "admin" ? "Full" : `${p.capabilities.length}`}<br />{p.role === "admin" ? "access" : p.customPermissions ? "custom" : "default"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0 space-y-4">
          {selected ? (
            <>
              <div className="acx-card flex flex-wrap items-center gap-3">
                <Avatar person={selected} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl leading-tight">{selected.name || selected.email}</p>
                  <p className="text-xs text-text-muted">{ROLE_LABELS[selected.role] || selected.role} · {selected.email}{selected.lastActiveAt ? ` · active ${timeAgo(selected.lastActiveAt)}` : ""}</p>
                </div>
                <Link to={`${base}/users/${selected.id}`} className="acx-btn-ghost"><ExternalLink size={14} /> Profile & password</Link>
              </div>
              <AccessEditor person={selected} viewer={{ ...profile, id: profile?.id || profile?.uid }} onSaved={onSaved} />
            </>
          ) : (
            <EmptyState icon={Users} title="Pick someone" description="Choose a person on the left to see and change what they can do." />
          )}

          {staffRows.length > 0 && (
            <details className="acx-card">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-accent" /> Role defaults at a glance</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="acx-matrix">
                  <thead><tr><th>Permission</th><th>Admin</th><th>Alpha</th><th>Agent</th></tr></thead>
                  <tbody>
                    {staffRows.map((c) => (
                      <tr key={c.key}>
                        <td><span className="font-medium">{c.label}</span><span className="block text-xs text-text-muted">{c.group}</span></td>
                        <td>●</td>
                        <td>{catalog.roleDefaults.alphaAgent?.includes(c.key) ? "●" : "–"}</td>
                        <td>{catalog.roleDefaults.agent?.includes(c.key) ? "●" : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
