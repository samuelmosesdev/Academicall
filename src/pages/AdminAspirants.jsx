import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Building2, CheckCircle2, Compass, Loader2, Mail, Pencil, Phone, ShieldCheck, Trash2, Users } from "lucide-react";
import { adminAspirantsApi, institutionTitle } from "../lib/aspirantApi";
import { usersApi } from "../lib/api";
import { timeAgo } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/roles";
import { appConfirm, notify } from "../lib/dialogs";
import { Drawer, PageHeader, Pager, SearchField, SkeletonRows } from "../components/ui";
import { InstitutionChoice, choicesFromProfile } from "../components/house/AspirantChoicesForm";
import { useInstitutionSearch, institutionLabel } from "../hooks/useInstitutions";

/** Admin / agents with aspirants.view: every aspirant, their institutions of choice and details. */
export default function AdminAspirants() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [inst, setInst] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    try { setData(await adminAspirantsApi.list({ q, status, institutionId: inst?.id, page, pageSize })); } catch (e) { setErr(e.message); }
  }, [q, status, inst?.id, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  return (
    <div className="space-y-6">
      <PageHeader title="Aspirants" description="People seeking admission, their first and second choices, UTME details and Aspirant House activity." actions={can(profile, "houses.manage") || can(profile, "users.houseLeader") ? <Link to={profile?.role === "admin" ? "/admin/houses" : "/agent/houses"} className="acx-btn"><Building2 size={14} /> Aspirant Houses</Link> : null} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="acx-stat is-ink"><p className="acx-stat-n text-white">{stats ? stats.total.toLocaleString() : "…"}</p><p className="acx-stat-l text-white">Aspirants</p><p className="acx-stat-h text-white/60">{stats ? `${stats.newThisWeek} joined this week` : ""}</p></div>
        <div className="acx-stat"><p className="acx-stat-n">{stats ? stats.suspended : "…"}</p><p className="acx-stat-l">Suspended</p><p className="acx-stat-h">Can't sign in</p></div>
        <div className="acx-stat is-lemon col-span-2">
          <p className="acx-stat-l !mt-0">Most chosen first choices</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(stats?.topFirstChoices || []).map((t) => (
              <button key={t.institution.id} type="button" onClick={() => { setInst(t.institution); setPage(1); }} className="rounded-full bg-midnight/10 px-2.5 py-1 text-xs font-semibold text-midnight hover:bg-midnight hover:text-lemon">
                {t.institution.abbreviation || institutionTitle(t.institution)} · {t.count}
              </button>
            ))}
            {stats && !stats.topFirstChoices.length && <span className="text-xs text-midnight/60">No choices yet</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[["", "All"], ["active", "Active"], ["suspended", "Suspended"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setStatus(id); setPage(1); }} className={`news-cat ${status === id ? "on" : ""}`}>{label}</button>
        ))}
        <InstitutionFilter value={inst} onChange={(v) => { setInst(v); setPage(1); }} />
        <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, phone or ID" className="ml-auto w-full sm:w-72" />
      </div>

      {err && <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>}
      <div className="acx-table-wrap">
        <table className="acx-table">
          <thead><tr><th>Aspirant</th><th>First choice</th><th>Second choice</th><th>UTME</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {!data && <SkeletonRows cols={6} />}
            {data?.aspirants.map((a) => {
              const c1 = a.choices.find((c) => c.rank === 1), c2 = a.choices.find((c) => c.rank === 2);
              return (
                <tr key={a.id} onClick={() => setOpenId(a.id)} className={`cursor-pointer ${openId === a.id ? "is-on" : ""}`}>
                  <td>
                    <p className="font-semibold text-text-primary">{a.name || "—"}</p>
                    <p className="text-xs text-text-muted">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                  </td>
                  <td>{c1 ? <><p className="font-medium text-text-primary">{institutionTitle(c1.institution)}</p><p className="text-xs text-text-muted">{c1.course || "Course not set"}</p></> : <span className="text-xs text-status-warning">Not chosen</span>}</td>
                  <td>{c2 ? <><p className="text-text-primary">{institutionTitle(c2.institution)}</p><p className="text-xs text-text-muted">{c2.course || ""}</p></> : <span className="text-xs text-text-muted">—</span>}</td>
                  <td className="whitespace-nowrap">{a.aspirantMeta?.utmeScore ?? "—"}{a.aspirantMeta?.utmeYear ? <span className="text-xs text-text-muted"> · {a.aspirantMeta.utmeYear}</span> : null}</td>
                  <td className="whitespace-nowrap text-xs">{timeAgo(a.createdAt)}</td>
                  <td><span className={`acx-chip-sm ${a.status === "active" ? "is-aqua" : "is-danger"}`}>{a.status}</span>{!a.emailVerified && <span className="acx-chip-sm ml-1">unverified</span>}</td>
                </tr>
              );
            })}
            {data && !data.aspirants.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-text-muted"><Compass className="mx-auto mb-2" />No aspirants match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}

      <AspirantDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} canManage={can(profile, "aspirants.manage")} canDelete={can(profile, "users.delete")} viewerRole={profile?.role} />
    </div>
  );
}

function InstitutionFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results } = useInstitutionSearch(query, { enabled: open });
  if (value) return <button type="button" onClick={() => onChange(null)} className="news-cat on">{value.abbreviation || institutionLabel(value)} ✕</button>;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="news-cat"><Building2 size={13} className="mr-1 inline" /> Institution</button>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-80 rounded-2xl border border-border-subtle bg-bg-panel p-2 shadow-xl">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search institutions" className="acx-input" />
          <div className="mt-1 max-h-60 overflow-y-auto">
            {results.map((r) => <button key={r.id} type="button" onClick={() => { onChange(r); setOpen(false); }} className="block w-full rounded-xl px-2.5 py-2 text-left text-sm hover:bg-bg-panel-alt">{institutionLabel(r)}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

function AspirantDrawer({ id, onClose, onChanged, canManage, canDelete }) {
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [first, setFirst] = useState(null);
  const [second, setSecond] = useState(null);

  const load = useCallback(() => id && adminAspirantsApi.get(id).then((r) => { setD(r); const c = choicesFromProfile({ aspirations: r.aspirant.choices }); setFirst(c.first); setSecond(c.second); }).catch((e) => notify.error(e.message)), [id]);
  useEffect(() => { setD(null); setEditing(false); load(); }, [load]);

  async function setStatus(status) {
    if (!(await appConfirm(status === "suspended" ? "Suspend this aspirant? They're signed out and can't sign in until reactivated." : "Reactivate this account?", { tone: status === "suspended" ? "danger" : undefined, confirmLabel: status === "suspended" ? "Suspend" : "Reactivate" }))) return;
    setBusy("status");
    try { await adminAspirantsApi.update(id, { status }); notify.success(status === "suspended" ? "Suspended" : "Reactivated"); load(); onChanged(); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }
  async function saveChoices() {
    if (!first?.institution?.id) { notify.error("Pick a first choice"); return; }
    setBusy("choices");
    try {
      await adminAspirantsApi.update(id, {
        firstChoice: { institutionId: first.institution.id, course: first.course || null, programId: first.programId || null },
        secondChoice: second?.institution?.id ? { institutionId: second.institution.id, course: second.course || null, programId: second.programId || null } : null,
      });
      notify.success("Choices updated"); setEditing(false); load(); onChanged();
    } catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }
  async function remove() {
    if (!(await appConfirm("Delete this aspirant account? This can't be undone.", { tone: "danger", confirmLabel: "Delete account" }))) return;
    setBusy("delete");
    try { await usersApi.remove?.(id); notify.success("Account deleted"); onClose(); onChanged(); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }

  const a = d?.aspirant;
  return (
    <Drawer open={!!id} onClose={onClose} title={a?.name || "Aspirant"} subtitle="Aspirant">
      {!d ? <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Loading…</div> : (
        <div className="space-y-5">
          <div className="space-y-1.5 text-sm text-text-secondary">
            <p className="flex items-center gap-2"><Mail size={14} /> {a.email} {a.emailVerified ? <CheckCircle2 size={13} className="text-status-success" /> : <span className="acx-chip-sm">unverified</span>}</p>
            {a.phone && <p className="flex items-center gap-2"><Phone size={14} /> {a.phone}</p>}
            <p className="flex items-center gap-2"><ShieldCheck size={14} /> {a.uniqueId || "No unique ID yet"} · joined {timeAgo(a.createdAt)}{a.lastActiveAt ? ` · active ${timeAgo(a.lastActiveAt)}` : ""}</p>
          </div>

          <section className="acx-card">
            <header className="acx-card-head"><div><h3>Institutions of choice</h3><p>Changing them moves the aspirant between houses.</p></div>
              {canManage && !editing && <button type="button" className="acx-btn-ghost" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>}
            </header>
            {editing ? (
              <div className="space-y-3">
                <InstitutionChoice label="First choice" value={first} onChange={setFirst} exclude={second?.institution?.id} required />
                <InstitutionChoice label="Second choice" optional value={second} onChange={setSecond} exclude={first?.institution?.id} onClear={() => setSecond(null)} />
                <div className="flex justify-end gap-2"><button type="button" className="acx-btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button type="button" className="acx-btn" disabled={busy === "choices"} onClick={saveChoices}>{busy === "choices" ? "Saving…" : "Save choices"}</button></div>
              </div>
            ) : (
              <div className="space-y-2">
                {a.choices.map((c) => (
                  <div key={c.rank} className="rounded-xl bg-bg-panel-alt px-3 py-2.5">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-text-muted">{c.rank === 1 ? "First choice" : "Second choice"}</p>
                    <p className="font-medium text-text-primary">{institutionTitle(c.institution)}</p>
                    <p className="text-xs text-text-muted">{c.course || "Course not set"} · {[c.institution.state, c.institution.ownership].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
                {!a.choices.length && <p className="text-sm text-status-warning">No choices yet. They haven't finished setup.</p>}
              </div>
            )}
          </section>

          <section className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-bg-panel-alt p-3"><p className="font-display text-xl">{a.aspirantMeta?.utmeScore ?? "—"}</p><p className="text-xs text-text-muted">UTME score</p></div>
            <div className="rounded-xl bg-bg-panel-alt p-3"><p className="font-display text-xl">{a.aspirantMeta?.utmeYear ?? "—"}</p><p className="text-xs text-text-muted">UTME year</p></div>
            <div className="rounded-xl bg-bg-panel-alt p-3"><p className="truncate font-display text-xl">{a.aspirantMeta?.stateOfOrigin ?? "—"}</p><p className="text-xs text-text-muted">State</p></div>
          </section>

          <section className="acx-card">
            <header className="acx-card-head"><div><h3>Aspirant Houses</h3><p>{d.replies} replies written</p></div></header>
            <div className="space-y-1.5">
              {d.memberships.map((m) => (
                <div key={m.house.id} className="flex items-center gap-2 text-sm">
                  <Users size={14} className="text-text-muted" />
                  <span className="flex-1 truncate text-text-primary">{m.house.name}</span>
                  <span className={`acx-chip-sm ${m.status === "active" ? "is-aqua" : "is-danger"}`}>{m.status}</span>
                </div>
              ))}
              {!d.memberships.length && <p className="text-sm text-text-muted">Not in any house.</p>}
            </div>
          </section>

          {canManage && (
            <div className="grid gap-2 sm:grid-cols-2">
              {a.status === "active"
                ? <button type="button" className="acx-action is-danger" disabled={busy === "status"} onClick={() => setStatus("suspended")}><Ban size={16} /> Suspend account<small>Signs them out everywhere</small></button>
                : <button type="button" className="acx-action" disabled={busy === "status"} onClick={() => setStatus("active")}><CheckCircle2 size={16} /> Reactivate<small>They can sign in again</small></button>}
              {canDelete && <button type="button" className="acx-action is-danger" disabled={busy === "delete"} onClick={remove}><Trash2 size={16} /> Delete account<small>Permanent</small></button>}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
