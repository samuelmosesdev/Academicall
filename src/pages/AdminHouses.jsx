import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, ExternalLink, Loader2, MessageCircle, Pencil, Plus, Search, Shield, UserPlus, Users, X } from "lucide-react";
import { adminHousesApi, institutionTitle } from "../lib/aspirantApi";
import { timeAgo } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/roles";
import { appConfirm, notify } from "../lib/dialogs";
import { Drawer, PageHeader, Pager, SearchField } from "../components/ui";
import { Avatar } from "../components/house/Mentions";
import { InstitutionChoice } from "../components/house/AspirantChoicesForm";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";

/** Every Aspirant House: members, activity, leaders. Admins pick House Leaders here. */
export default function AdminHouses() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const canLead = can(profile, "users.houseLeader");
  const canManage = can(profile, "houses.manage");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await adminHousesApi.list({ q, page });
      setData(r);
      setOpen((o) => (o ? r.houses.find((h) => h.id === o.id) || o : o));
    } catch (e) { setErr(e.message); }
  }, [q, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aspirant Houses"
        description="One house per institution. Aspirants join the houses of their choices; House Leaders run them."
        actions={canManage && <button type="button" className="acx-btn" onClick={() => setCreating(true)}><Plus size={14} /> Open a house</button>}
      />
      <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search houses or institutions" className="w-full sm:w-80" />
      {err && <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>}
      {!data && !err && <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Loading houses…</div>}
      {data && !data.houses.length && <p className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-text-muted">No houses yet. A house opens the first time an aspirant picks an institution, or open one yourself.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.houses.map((h) => (
          <button key={h.id} type="button" onClick={() => setOpen(h)} className={`acx-card text-left transition hover:border-accent ${h.archived ? "opacity-60" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{h.institution?.abbreviation || h.institution?.state || "Institution"}</p>
            <p className="mt-1 font-display text-[1.2rem] leading-snug text-text-primary">{h.name}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1"><Users size={13} /> {h.memberCount}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {h.threadCount}</span>
              {h.archived && <span className="acx-chip-sm">closed</span>}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
              {h.leaders.length ? (
                <>
                  <span className="flex -space-x-2">{h.leaders.slice(0, 4).map((l) => <span key={l.id} className="rounded-full ring-2 ring-bg-panel"><Avatar person={l} size={24} /></span>)}</span>
                  <span className="truncate text-xs text-text-secondary">{h.leaders.map((l) => l.name).join(", ")}</span>
                </>
              ) : <span className="text-xs font-medium text-status-warning">No House Leader yet</span>}
            </div>
          </button>
        ))}
      </div>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}

      <HouseDrawer house={open} onClose={() => setOpen(null)} onChanged={load} canLead={canLead} canManage={canManage} />
      {creating && <CreateHouse onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function HouseDrawer({ house, onClose, onChanged, canLead, canManage }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState(null);

  useEffect(() => { setQ(""); setPeople([]); setEdit(null); }, [house?.id]);
  useEffect(() => {
    if (q.trim().length < 2) { setPeople([]); return undefined; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => adminHousesApi.candidates(q.trim()).then((r) => alive && setPeople(r.people)).catch(() => {}).finally(() => alive && setSearching(false)), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  if (!house) return null;
  async function add(p) {
    setBusy(p.id);
    try { await adminHousesApi.addLeader(house.id, p.id); notify.success(`${p.name} now leads ${house.name}`); setQ(""); onChanged(); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }
  async function remove(l) {
    if (!(await appConfirm(`Remove ${l.name} as a leader of ${house.name}? They keep the House Leader duty for any other houses.`, { confirmLabel: "Remove leader" }))) return;
    setBusy(l.id);
    try { await adminHousesApi.removeLeader(house.id, l.id); notify.success("Leader removed"); onChanged(); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }
  async function save(body, msg) {
    setBusy("save");
    try { await adminHousesApi.update(house.id, body); notify.success(msg); setEdit(null); onChanged(); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }
  async function cover(file) {
    if (!file) return;
    setBusy("cover");
    try { const r = await uploadImageToCloudinary(file); setEdit((e) => ({ ...e, coverUrl: r.secure_url })); }
    catch (e) { notify.error(e.message); } finally { setBusy(""); }
  }

  return (
    <Drawer open onClose={onClose} title={house.name} subtitle={institutionTitle(house.institution)}
      actions={<Link to={`/house-desk/${house.id}`} className="acx-btn-ghost"><ExternalLink size={13} /> Open</Link>}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-bg-panel-alt p-3"><p className="font-display text-xl">{house.memberCount}</p><p className="text-[11px] text-text-muted">members</p></div>
          <div className="rounded-xl bg-bg-panel-alt p-3"><p className="font-display text-xl">{house.threadCount}</p><p className="text-[11px] text-text-muted">threads</p></div>
          <div className="rounded-xl bg-bg-panel-alt p-3"><p className="font-display text-[1rem] leading-7">{house.lastThreadAt ? timeAgo(house.lastThreadAt) : "—"}</p><p className="text-[11px] text-text-muted">last post</p></div>
        </div>

        <section className="acx-card">
          <header className="acx-card-head"><div><h3>House Leaders</h3><p>Students or agents. They start threads, pin, mention and manage members.</p></div></header>
          <div className="space-y-2">
            {house.leaders.map((l) => (
              <div key={l.id} className="flex items-center gap-2.5">
                <Avatar person={l} size={32} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{l.name}</p><p className="truncate text-xs text-text-muted">{l.email} · {l.role === "user" ? "Student" : l.role}</p></div>
                {canLead && <button type="button" disabled={busy === l.id} onClick={() => remove(l)} className="acx-icon-btn is-danger" aria-label={`Remove ${l.name}`}><X size={14} /></button>}
              </div>
            ))}
            {!house.leaders.length && <p className="text-sm text-text-muted">No leader yet. Members can read but nobody can post.</p>}
          </div>
          {canLead && (
            <div className="mt-4">
              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a leader: search students or agents" className="acx-input pl-9" />
              </label>
              {searching && <p className="mt-2 text-xs text-text-muted">Searching…</p>}
              <div className="mt-1 space-y-1">
                {people.filter((p) => !house.leaders.some((l) => l.id === p.id)).map((p) => (
                  <button key={p.id} type="button" disabled={busy === p.id} onClick={() => add(p)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-bg-panel-alt">
                    <Avatar person={p} size={28} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text-primary">{p.name}</span><span className="block truncate text-xs text-text-muted">{p.email}</span></span>
                    {p.leader && <Shield size={13} className="text-aqua-deep" />}
                    <UserPlus size={15} className="text-accent" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {canManage && (
          <section className="acx-card">
            <header className="acx-card-head"><div><h3>House details</h3><p>Name, motto, cover and rules members see.</p></div>
              {!edit && <button type="button" className="acx-btn-ghost" onClick={() => setEdit({ name: house.name, motto: house.motto || "", rules: house.rules || "", coverUrl: house.coverUrl || "" })}><Pencil size={13} /> Edit</button>}
            </header>
            {edit ? (
              <div className="space-y-3">
                <input className="acx-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="House name" />
                <input className="acx-input" value={edit.motto} onChange={(e) => setEdit({ ...edit, motto: e.target.value })} placeholder="Motto" maxLength={160} />
                <textarea className="acx-input" rows={4} value={edit.rules} onChange={(e) => setEdit({ ...edit, rules: e.target.value })} placeholder="House rules (optional)" />
                <div className="flex items-center gap-2">
                  {edit.coverUrl && <img src={edit.coverUrl} alt="" className="h-12 w-20 rounded-lg object-cover" />}
                  <label className="acx-btn-ghost cursor-pointer">{busy === "cover" ? "Uploading…" : edit.coverUrl ? "Change cover" : "Add cover"}<input type="file" accept="image/*" hidden onChange={(e) => cover(e.target.files?.[0])} /></label>
                  {edit.coverUrl && <button type="button" className="text-xs text-text-muted" onClick={() => setEdit({ ...edit, coverUrl: "" })}>Remove</button>}
                </div>
                <div className="flex justify-end gap-2"><button type="button" className="acx-btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="acx-btn" disabled={busy === "save"} onClick={() => save({ name: edit.name, motto: edit.motto || null, rules: edit.rules || null, coverUrl: edit.coverUrl || null }, "House updated")}>Save</button></div>
              </div>
            ) : (
              <div className="space-y-1 text-sm text-text-secondary"><p>{house.motto || "No motto"}</p>{house.rules && <p className="whitespace-pre-line text-xs text-text-muted">{house.rules}</p>}</div>
            )}
            <button type="button" className={`acx-action mt-4 w-full ${house.archived ? "" : "is-danger"}`} onClick={() => save({ archived: !house.archived }, house.archived ? "House reopened" : "House closed")}>
              {house.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />} {house.archived ? "Reopen house" : "Close house"}<small>{house.archived ? "Members can read and reply again" : "Members can't open it until reopened"}</small>
            </button>
          </section>
        )}
      </div>
    </Drawer>
  );
}

function CreateHouse({ onClose, onCreated }) {
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!choice?.institution) return;
    setBusy(true);
    try { await adminHousesApi.create(choice.institution.id); notify.success("House opened"); onCreated(); }
    catch (e) { notify.error(e.message); } finally { setBusy(false); }
  }
  return (
    <Drawer open onClose={onClose} title="Open a house" subtitle="Aspirant Houses">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Houses open automatically when an aspirant picks an institution. Open one early to give it leaders before aspirants arrive.</p>
        <InstitutionChoice label="Institution" value={choice} onChange={(v) => setChoice(v)} />
        <button type="button" className="acx-btn" disabled={!choice?.institution || busy} onClick={create}>{busy ? "Opening…" : "Open house"}</button>
      </div>
    </Drawer>
  );
}
