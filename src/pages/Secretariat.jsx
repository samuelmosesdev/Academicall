import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams, useOutletContext } from "react-router-dom";
import {
  ArrowLeft, Feather, FileText, ScrollText, LayoutGrid, Plus, Search, Lock, Paperclip, Upload, X, Archive,
  CheckCircle2, Save, Trash2, Download, Inbox, Users, CalendarDays, ClipboardCheck, Wallet,
} from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "../components/ui";
import { secretariatApi, RECORD_KINDS, formatBytes, timeAgo } from "../lib/staffApi";
import { useAuth } from "../context/AuthContext";
import { homePathFor, ROLE_LABELS, DUTY_LABELS } from "../lib/roles";
import { uploadDocumentToCloudinary } from "../lib/cloudinaryUpload";
import { appConfirm, notify } from "../lib/dialogs";

const kindLabel = (k) => RECORD_KINDS.find((x) => x.id === k)?.label || k;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

const AREA_LABELS = {
  role: "Roles", user: "Accounts", duty: "Duties", permissions: "Permissions", material: "Materials", vault: "Vault",
  secretariat: "Secretariat", group_file: "Group files", announcement: "Announcements", request: "Requests", payment: "Payments",
};
function describe(action) {
  const map = {
    "role.change": "changed a role", "user.suspend": "suspended", "user.reactivate": "reactivated", "user.delete": "closed the account of",
    "user.force_password_change": "forced a password change for", "user.temp_password": "issued a temporary password to",
    "user.sign_out_everywhere": "signed out everywhere", "duty.change": "changed duties for", "permissions.change": "changed permissions for",
    "material.delete": "deleted material", "material.restore": "restored material", "material.purge": "permanently deleted",
    "material.approved": "approved", "material.rejected": "rejected", "vault.restore": "restored a vault file", "vault.open": "opened a vault file",
    "vault.unlock": "cleared a vault lockout", "group_file.restore": "restored a group file",
    "secretariat.record_create": "opened record", "secretariat.record_edit": "edited record", "secretariat.record_filed": "filed record",
    "secretariat.record_archived": "archived record", "secretariat.record_draft": "reopened record", "secretariat.record_remove": "removed record",
  };
  return map[action] || action.replace(/[._]/g, " ");
}

// ── layout ───────────────────────────────────────────────────────────────────
export function SecretariatLayout() {
  const { profile } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => secretariatApi.overview().then(setOverview).catch((e) => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);
  const can = overview?.can || {};
  const nav = [
    { to: "/secretariat", end: true, label: "Overview", icon: LayoutGrid },
    { to: "/secretariat/records", label: "Register", icon: FileText },
    ...(can.activity ? [{ to: "/secretariat/journal", label: "Activity journal", icon: ScrollText }] : []),
  ];
  return (
    <div className="sec-shell">
      <header className="sec-mast">
        <div className="sec-mast-inner">
          <Link to={homePathFor(profile)} className="sec-back"><ArrowLeft size={15} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="sec-eyebrow"><Feather size={13} /> Office of the Secretary</p>
              <h1 className="sec-title">Academicall Secretariat</h1>
              <p className="sec-sub">Records, minutes and the platform's paper trail, kept in one register.</p>
            </div>
            {can.records && <Link to="/secretariat/records/new" className="sec-new"><Plus size={16} /> New record</Link>}
          </div>
          <nav className="sec-tabs">
            {nav.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "is-on" : "")}><Icon size={15} /> {label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="sec-main">
        {error ? <ErrorState title="Secretariat unavailable" message={error} onRetry={reload} /> : !overview ? <LoadingState message="Opening the Secretariat…" /> : <Outlet context={{ overview, reload, can }} />}
      </main>
    </div>
  );
}

// ── overview ────────────────────────────────────────────────────────────────
export function SecretariatOverview() {
  const { overview } = useOutletContext();
  const { profile } = useAuth();
  const first = profile?.nickname || profile?.name?.split(" ")[0] || "there";
  const byKind = overview.records.byKind || {};
  const total = Object.values(byKind).reduce((a, b) => a + b, 0);
  const areas = Object.entries(overview.activity?.byArea || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxArea = Math.max(1, ...areas.map(([, n]) => n));
  return (
    <div className="space-y-6">
      <p className="font-display text-[1.6rem] leading-tight text-text-primary">Good day, {first}. <span className="text-text-muted">Here's what the office is holding.</span></p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="acx-stat is-ink"><p className="acx-stat-n">{total}</p><p className="acx-stat-l">Records on file</p><p className="acx-stat-h">{overview.records.byStatus?.draft || 0} drafts · {overview.records.byStatus?.archived || 0} archived</p></div>
        <div className="acx-stat"><p className="acx-stat-n"><ClipboardCheck size={18} className="mr-1 inline text-accent" />{overview.waiting.requests}</p><p className="acx-stat-l">Requests waiting</p><p className="acx-stat-h">Profile changes and approvals</p></div>
        <div className="acx-stat"><p className="acx-stat-n"><FileText size={18} className="mr-1 inline text-accent" />{overview.waiting.materials}</p><p className="acx-stat-l">Materials to review</p><p className="acx-stat-h">Uploaded, not yet approved</p></div>
        <div className="acx-stat is-lemon"><p className="acx-stat-n"><Wallet size={18} className="mr-1 inline" />{overview.waiting.payments}</p><p className="acx-stat-l">Payment claims</p><p className="acx-stat-h">{overview.week.newUsers} new students this week</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="acx-card">
          <header className="acx-card-head"><div><h3>Latest in the register</h3><p>Recently opened or edited.</p></div><Link to="/secretariat/records" className="acx-btn-ghost">Open register</Link></header>
          {overview.records.recent.length === 0
            ? <EmptyState icon={Inbox} title="The register is empty" description="Start with a memo or the minutes of your last meeting." />
            : <ul className="divide-y divide-border-subtle">{overview.records.recent.map((r) => <RecordLine key={r.id} r={r} />)}</ul>}
        </section>

        <div className="space-y-6">
          <section className="acx-card">
            <header className="acx-card-head"><div><h3>By type</h3><p>Everything in the register, archive included.</p></div></header>
            <div className="grid grid-cols-2 gap-2">
              {RECORD_KINDS.map((k) => (
                <Link key={k.id} to={`/secretariat/records?kind=${k.id}`} className="sec-kind"><span>{k.label}</span><b>{byKind[k.id] || 0}</b></Link>
              ))}
            </div>
          </section>
          {overview.activity && (
            <section className="acx-card">
              <header className="acx-card-head"><div><h3>This week</h3><p>{overview.activity.total} logged actions</p></div><Link to="/secretariat/journal" className="acx-btn-ghost">Journal</Link></header>
              <ul className="space-y-2">
                {areas.map(([k, n]) => (
                  <li key={k} className="text-xs"><div className="mb-1 flex justify-between"><span className="font-medium text-text-secondary">{AREA_LABELS[k] || k}</span><span className="text-text-muted">{n}</span></div><div className="sec-bar"><span style={{ width: `${(n / maxArea) * 100}%` }} /></div></li>
                ))}
                {areas.length === 0 && <li className="text-xs text-text-muted">Quiet week so far.</li>}
              </ul>
            </section>
          )}
          <section className="acx-card">
            <header className="acx-card-head"><div><h3 className="flex items-center gap-2"><Users size={15} /> On duty</h3><p>Staff and duty holders, most recently active first.</p></div></header>
            <ul className="space-y-2">
              {overview.staff.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className={`sec-dot ${s.lastActiveAt && Date.now() - new Date(s.lastActiveAt) < 15 * 60000 ? "is-live" : ""}`} />
                  <span className="min-w-0 flex-1 truncate">{s.name || s.email}</span>
                  <span className="text-xs text-text-muted">{[ROLE_LABELS[s.role] && s.role !== "user" ? ROLE_LABELS[s.role] : null, ...(s.staffTags || []).map((t) => DUTY_LABELS[t])].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function RecordLine({ r }) {
  return (
    <li>
      <Link to={`/secretariat/records/${r.id}`} className="sec-record">
        <span className="sec-ref">{r.refNo}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text-primary">{r.confidential && <Lock size={12} className="text-status-danger" />}{r.title}</span>
          <span className="block truncate text-xs text-text-muted">{kindLabel(r.kind)} · {r.createdBy?.name || "Secretariat"} · {timeAgo(r.updatedAt)}{r.attachments?.length ? ` · ${r.attachments.length} attachment${r.attachments.length > 1 ? "s" : ""}` : ""}</span>
        </span>
        <span className={`acx-chip-sm ${r.status === "filed" ? "is-aqua" : r.status === "draft" ? "is-lemon" : ""}`}>{r.status}</span>
      </Link>
    </li>
  );
}

// ── register ────────────────────────────────────────────────────────────────
export function SecretariatRecords() {
  const params = new URLSearchParams(window.location.search);
  const [kind, setKind] = useState(params.get("kind") || "");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      secretariatApi.records({ kind, status, q }).then((r) => setRows(r.records)).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [kind, status, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, reference number or tag" className="acx-input pl-9" /></div>
        <div className="acx-seg">
          <button type="button" className={status === "" ? "is-on" : ""} onClick={() => setStatus("")}>Open</button>
          <button type="button" className={status === "draft" ? "is-on" : ""} onClick={() => setStatus("draft")}>Drafts</button>
          <button type="button" className={status === "filed" ? "is-on" : ""} onClick={() => setStatus("filed")}>Filed</button>
          <button type="button" className={status === "archived" ? "is-on" : ""} onClick={() => setStatus("archived")}><Archive size={13} /> Archived</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={`acx-filter ${kind === "" ? "is-on" : ""}`} onClick={() => setKind("")}>All types</button>
        {RECORD_KINDS.map((k) => <button key={k.id} type="button" className={`acx-filter ${kind === k.id ? "is-on" : ""}`} onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      {error && <ErrorState message={error} />}
      {!rows && !error && <LoadingState message="Loading the register…" />}
      {rows && rows.length === 0 && <EmptyState icon={Inbox} title="Nothing here" description="No records match. Try another filter or open a new record." />}
      {rows && rows.length > 0 && <ul className="acx-card !p-1.5">{rows.map((r) => <RecordLine key={r.id} r={r} />)}</ul>}
    </div>
  );
}

// ── one record ──────────────────────────────────────────────────────────────
const EMPTY = { kind: "memo", title: "", summary: "", body: "", status: "draft", confidential: false, tags: [], attachments: [], meetingDate: "" };

export function SecretariatRecord() {
  const { id } = useParams();
  const isNew = id === undefined || id === "new";
  const navigate = useNavigate();
  const { can, reload } = useOutletContext();
  const [rec, setRec] = useState(isNew ? EMPTY : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tagText, setTagText] = useState("");
  const [upload, setUpload] = useState(null);
  const fileRef = useRef(null);
  const editable = can.records && rec?.status !== "archived";

  useEffect(() => {
    if (isNew) { setRec(EMPTY); return; }
    secretariatApi.record(id).then(({ record }) => {
      setRec({ ...record, meetingDate: record.meetingDate ? record.meetingDate.slice(0, 10) : "", attachments: record.attachments || [] });
      setTagText((record.tags || []).join(", "));
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  const set = (patch) => setRec((r) => ({ ...r, ...patch }));

  async function save(nextStatus) {
    if (!rec.title.trim()) { notify.error("Give the record a title"); return; }
    setBusy(nextStatus || "save");
    const body = {
      kind: rec.kind, title: rec.title.trim(), summary: rec.summary || null, body: rec.body || "",
      confidential: !!rec.confidential, tags: tagText.split(",").map((t) => t.trim()).filter(Boolean),
      attachments: rec.attachments, meetingDate: rec.meetingDate || null, status: nextStatus || rec.status,
    };
    try {
      const { record } = isNew ? await secretariatApi.create(body) : await secretariatApi.update(rec.id, body);
      notify.success(isNew ? `Opened as ${record.refNo}` : nextStatus === "filed" ? "Filed" : nextStatus === "archived" ? "Archived" : "Saved");
      reload();
      if (isNew) navigate(`/secretariat/records/${record.id}`, { replace: true });
      else setRec({ ...record, meetingDate: record.meetingDate ? record.meetingDate.slice(0, 10) : "", attachments: record.attachments || [] });
    } catch (e) {
      notify.error(e.message || "Couldn't save");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!(await appConfirm(`Remove ${rec.refNo} from the register?`, { confirmLabel: "Remove", tone: "danger" }))) return;
    try { await secretariatApi.remove(rec.id); notify.success("Removed"); reload(); navigate("/secretariat/records"); } catch (e) { notify.error(e.message); }
  }

  async function addFiles(files) {
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) { notify.error(`${file.name} is over 20 MB`); continue; }
      setUpload({ name: file.name, pct: 0 });
      try {
        const res = await uploadDocumentToCloudinary(file, (pct) => setUpload({ name: file.name, pct }));
        setRec((r) => ({ ...r, attachments: [...(r.attachments || []), { name: file.name, url: res.secure_url, mime: file.type || null, size: file.size }] }));
      } catch (e) {
        notify.error(e.message || "Upload failed");
      }
    }
    setUpload(null);
  }

  function exportText() {
    const lines = [`ACADEMICALL SECRETARIAT`, rec.refNo || "", `${kindLabel(rec.kind).toUpperCase()}: ${rec.title}`, rec.meetingDate ? `Date: ${fmtDate(rec.meetingDate)}` : "", rec.summary || "", "", rec.body || "", "", ...(rec.attachments || []).map((a) => `Attachment: ${a.name} ${a.url}`)];
    const blob = new Blob([lines.filter((l, i) => l || i > 4).join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(rec.refNo || "record").replace(/\//g, "-")}.txt`;
    a.click();
  }

  if (error) return <ErrorState title="Record unavailable" message={error} />;
  if (!rec) return <LoadingState message="Opening record…" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="sec-paper">
        <div className="sec-paper-head">
          <span className="sec-ref">{rec.refNo || "New record · number given on save"}</span>
          <span className={`acx-chip-sm ${rec.status === "filed" ? "is-aqua" : rec.status === "draft" ? "is-lemon" : ""}`}>{rec.status}</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {RECORD_KINDS.map((k) => (
            <button key={k.id} type="button" disabled={!editable} onClick={() => set({ kind: k.id })} className={`acx-filter ${rec.kind === k.id ? "is-on" : ""}`}>{k.label}</button>
          ))}
        </div>
        <input value={rec.title} disabled={!editable} onChange={(e) => set({ title: e.target.value })} placeholder="Title, e.g. Minutes of the staff meeting, week 6" className="sec-title-input" />
        <input value={rec.summary || ""} disabled={!editable} onChange={(e) => set({ summary: e.target.value })} placeholder="One-line summary (optional)" className="sec-summary-input" />
        <textarea value={rec.body} disabled={!editable} onChange={(e) => set({ body: e.target.value })} placeholder={rec.kind === "minutes" ? "Present:\nApologies:\n\n1. Matters arising\n2. …\n\nAction points:" : "Write the record here…"} className="sec-body-input" />

        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"><Paperclip size={13} /> Attachments</p>
          <ul className="space-y-1.5">
            {(rec.attachments || []).map((a, i) => (
              <li key={a.url} className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-panel px-3 py-2 text-sm">
                <FileText size={15} className="text-accent" />
                <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-accent">{a.name}</a>
                {a.size ? <span className="text-xs text-text-muted">{formatBytes(a.size)}</span> : null}
                {editable && <button type="button" className="acx-icon-btn" onClick={() => set({ attachments: rec.attachments.filter((_, j) => j !== i) })}><X size={14} /></button>}
              </li>
            ))}
            {upload && <li className="rounded-xl border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted">Uploading {upload.name}… {upload.pct}%</li>}
          </ul>
          {editable && (
            <>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
              <button type="button" className="acx-btn-ghost mt-2" onClick={() => fileRef.current?.click()}><Upload size={14} /> Attach files</button>
            </>
          )}
        </div>
      </article>

      <aside className="space-y-4">
        <section className="acx-card space-y-3">
          {(rec.kind === "minutes" || rec.meetingDate) && (
            <label className="block text-xs font-semibold text-text-muted"><span className="mb-1 flex items-center gap-1"><CalendarDays size={13} /> Meeting date</span>
              <input type="date" value={rec.meetingDate || ""} disabled={!editable} onChange={(e) => set({ meetingDate: e.target.value })} className="acx-input mt-1" />
            </label>
          )}
          <label className="block text-xs font-semibold text-text-muted">Tags
            <input value={tagText} disabled={!editable} onChange={(e) => setTagText(e.target.value)} placeholder="exams, staff, finance" className="acx-input mt-1" />
          </label>
          {can.confidential && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!rec.confidential} disabled={!editable} onChange={(e) => set({ confidential: e.target.checked })} /> <Lock size={13} className="text-status-danger" /> Confidential</label>
          )}
          {!isNew && (
            <p className="text-xs text-text-muted">Opened by {rec.createdBy?.name || "—"} · {fmtDate(rec.createdAt)}<br />Last edited by {rec.updatedByName || "—"} · {timeAgo(rec.updatedAt)}</p>
          )}
        </section>

        {editable && (
          <section className="acx-card space-y-2">
            <button type="button" className="acx-btn w-full justify-center" disabled={!!busy} onClick={() => save(rec.status === "draft" ? "filed" : undefined)}>
              {rec.status === "draft" ? <><CheckCircle2 size={15} /> {isNew ? "Open & file" : "File it"}</> : <><Save size={15} /> Save changes</>}
            </button>
            {rec.status === "draft" && <button type="button" className="acx-btn-ghost w-full justify-center" disabled={!!busy} onClick={() => save("draft")}><Save size={14} /> Save as draft</button>}
            {!isNew && can.archive && rec.status === "filed" && <button type="button" className="acx-btn-ghost w-full justify-center" disabled={!!busy} onClick={() => save("archived")}><Archive size={14} /> Archive</button>}
          </section>
        )}
        {!isNew && (
          <section className="acx-card space-y-2">
            <button type="button" className="acx-btn-ghost w-full justify-center" onClick={exportText}><Download size={14} /> Download as text</button>
            {can.archive && rec.status === "archived" && <button type="button" className="acx-btn-ghost w-full justify-center" onClick={() => save("filed")}><Archive size={14} /> Bring back from archive</button>}
            {can.archive && <button type="button" className="acx-btn-ghost w-full justify-center text-status-danger" onClick={remove}><Trash2 size={14} /> Remove from register</button>}
          </section>
        )}
      </aside>
    </div>
  );
}

// ── activity journal ────────────────────────────────────────────────────────
export function SecretariatJournal() {
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      secretariatApi.journal({ area, q, from: from || undefined, to: to ? `${to}T23:59:59` : undefined, limit: 300 })
        .then((r) => setRows(r.entries)).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [area, q, from, to]);

  const days = useMemo(() => {
    const map = new Map();
    for (const e of rows || []) {
      const k = new Date(e.at).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return [...map.entries()];
  }, [rows]);

  function exportCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["When,Who,Action,Subject", ...(rows || []).map((e) => [new Date(e.at).toISOString(), e.actor, e.action, e.target || ""].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `academicall-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Who or what" className="acx-input pl-9" /></div>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="acx-input !w-auto"><option value="">All areas</option>{Object.entries(AREA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="acx-input !w-auto" aria-label="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="acx-input !w-auto" aria-label="To" />
        <button type="button" className="acx-btn-ghost" onClick={exportCsv} disabled={!rows?.length}><Download size={14} /> CSV</button>
      </div>
      {error && <ErrorState message={error} />}
      {!rows && !error && <LoadingState message="Reading the journal…" />}
      {rows && rows.length === 0 && <EmptyState icon={ScrollText} title="No entries" description="Nothing logged for this filter." />}
      {days.map(([day, entries]) => (
        <section key={day} className="acx-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <ul className="sec-journal">
            {entries.map((e) => (
              <li key={e.id}>
                <span className="sec-journal-time">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 text-sm"><b className="font-semibold text-text-primary">{e.actor}</b> <span className="text-text-secondary">{describe(e.action)}</span>{e.target ? <> <b className="font-medium text-text-primary">{e.target}</b></> : null}{e.meta?.reason ? <span className="block text-xs text-text-muted">Reason: {e.meta.reason}</span> : null}</span>
                <span className="acx-chip-sm">{AREA_LABELS[e.action.split(".")[0]] || e.action.split(".")[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
