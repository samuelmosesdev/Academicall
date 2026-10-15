import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FileText, Image as ImageIcon, Film, Search, RotateCcw, Trash2, ExternalLink, Check, X, Lock, Unlock,
  FolderLock, Users, ArchiveRestore, ShieldAlert, Eye, ChevronLeft,
} from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../components/ui";
import { filesApi, formatBytes, timeAgo } from "../lib/staffApi";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/roles";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";

const STATUS_TONE = { approved: "is-aqua", pending: "is-lemon", rejected: "is-danger" };

function KindIcon({ kind, mime }) {
  if (kind === "image" || (mime || "").startsWith("image/")) return <ImageIcon size={18} />;
  if (kind === "video" || (mime || "").startsWith("video/")) return <Film size={18} />;
  return <FileText size={18} />;
}

function Toolbar({ q, setQ, state, setState, children, placeholder }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="acx-input pl-9" />
      </div>
      {children}
      {setState && (
        <div className="acx-seg">
          <button type="button" className={state === "active" ? "is-on" : ""} onClick={() => setState("active")}>Live</button>
          <button type="button" className={state === "deleted" ? "is-on" : ""} onClick={() => setState("deleted")}><Trash2 size={13} /> Deleted</button>
        </div>
      )}
    </div>
  );
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Materials({ base, profile }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("active");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const dq = useDebounced(q);
  const load = useCallback(() => {
    setError("");
    filesApi.materials({ q: dq, state, status, limit: 120 }).then((r) => setRows(r.materials)).catch((e) => setError(e.message));
  }, [dq, state, status]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const act = async (fn, okMsg) => {
    try { await fn(); notify.success(okMsg); load(); } catch (e) { notify.error(e.message || "That didn't work"); }
  };
  const review = can(profile, "documents.review");
  const manage = can(profile, "documents.manage");
  const admin = profile?.role === "admin";

  return (
    <div className="space-y-4">
      <Toolbar q={q} setQ={setQ} state={state} setState={setState} placeholder="Title, course code, uploader or student ID">
        {state === "active" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="acx-input !w-auto">
            <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
        )}
      </Toolbar>
      {error && <ErrorState message={error} onRetry={load} />}
      {!rows && !error && <LoadingState message="Loading materials…" />}
      {rows && rows.length === 0 && <EmptyState icon={FileText} title={state === "deleted" ? "Nothing deleted" : "No materials match"} description={state === "deleted" ? "Deleted materials wait here so they can be restored." : "Try another search."} />}
      {rows && rows.length > 0 && (
        <ul className="acx-list">
          {rows.map((d) => (
            <li key={d.id} className="acx-row">
              <span className="acx-row-icon">{d.thumbnailUrl ? <img src={d.thumbnailUrl} alt="" /> : <FileText size={18} />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{d.title}</p>
                <p className="truncate text-xs text-text-muted">
                  {[d.course?.code, d.department, d.level, d.fileSize ? formatBytes(d.fileSize) : null].filter(Boolean).join(" · ") || d.fileName || "—"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {d.uploadedBy ? <Link to={`${base}/users/${d.uploadedBy.id}`} className="font-medium hover:text-accent">{d.uploadedBy.name || d.uploadedBy.email}</Link> : "Unknown"}
                  {" · "}{state === "deleted" ? <>deleted {timeAgo(d.deletedAt)} by {d.deletedBy}</> : <>uploaded {timeAgo(d.createdAt)}{d.openCount ? ` · opened ${d.openCount}×` : ""}</>}
                </p>
              </div>
              <span className={`acx-chip-sm ${STATUS_TONE[d.status] || ""}`}>{d.status}</span>
              <div className="acx-row-actions">
                {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="acx-icon-btn" title="Open"><ExternalLink size={15} /></a>}
                {state === "active" && review && d.status !== "approved" && <button type="button" className="acx-icon-btn is-good" title="Approve" onClick={() => act(() => filesApi.setMaterialStatus(d.id, "approved"), "Approved")}><Check size={15} /></button>}
                {state === "active" && review && d.status === "pending" && <button type="button" className="acx-icon-btn" title="Reject" onClick={() => act(() => filesApi.setMaterialStatus(d.id, "rejected"), "Rejected")}><X size={15} /></button>}
                {state === "active" && manage && <button type="button" className="acx-icon-btn is-danger" title="Delete" onClick={async () => { if (await appConfirm(`Delete “${d.title}”? Students stop seeing it. You can restore it from Deleted.`, { confirmLabel: "Delete", tone: "danger" })) act(() => filesApi.removeMaterial(d.id), "Moved to Deleted"); }}><Trash2 size={15} /></button>}
                {state === "deleted" && manage && <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={() => act(() => filesApi.restoreMaterial(d.id), "Restored")}><RotateCcw size={13} /> Restore</button>}
                {state === "deleted" && admin && <button type="button" className="acx-icon-btn is-danger" title="Delete forever" onClick={async () => { if (await appConfirm(`Delete “${d.title}” forever? This can't be undone.`, { confirmLabel: "Delete forever", tone: "danger" })) act(() => filesApi.removeMaterial(d.id), "Deleted forever"); }}><Trash2 size={15} /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupFiles({ base }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("active");
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const dq = useDebounced(q);
  const load = useCallback(() => {
    setError("");
    filesApi.groupFiles({ q: dq, state, kind, limit: 120 }).then((r) => setRows(r.files)).catch((e) => setError(e.message));
  }, [dq, state, kind]);
  useEffect(() => { setRows(null); load(); }, [load]);

  return (
    <div className="space-y-4">
      <Toolbar q={q} setQ={setQ} state={state} setState={setState} placeholder="File name, group or sender">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="acx-input !w-auto">
          <option value="">All types</option><option value="document">Documents</option><option value="image">Photos</option><option value="video">Videos</option>
        </select>
      </Toolbar>
      {error && <ErrorState message={error} onRetry={load} />}
      {!rows && !error && <LoadingState message="Loading group files…" />}
      {rows && rows.length === 0 && <EmptyState icon={Users} title="No files here" description="Files shared in study groups show up here." />}
      {rows && rows.length > 0 && (
        <ul className="acx-list">
          {rows.map((f) => (
            <li key={f.id} className="acx-row">
              <span className="acx-row-icon">{f.thumbnailUrl ? <img src={f.thumbnailUrl} alt="" /> : <KindIcon kind={f.type} mime={f.mime} />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{f.name}</p>
                <p className="truncate text-xs text-text-muted">{f.group?.name || "Group"} · {f.size ? formatBytes(f.size) : f.type}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {f.sender ? <Link to={`${base}/users/${f.sender.id}`} className="font-medium hover:text-accent">{f.sender.name || f.sender.email}</Link> : "Former member"}
                  {" · "}{f.deletedAt ? <>deleted {timeAgo(f.deletedAt)} by {f.deletedBy}</> : <>shared {timeAgo(f.createdAt)}</>}
                </p>
              </div>
              <div className="acx-row-actions">
                {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="acx-icon-btn" title="Open"><ExternalLink size={15} /></a>}
                {f.restorable && <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={async () => { try { await filesApi.restoreGroupFile(f.id); notify.success("Back in the group chat"); load(); } catch (e) { notify.error(e.message); } }}><RotateCcw size={13} /> Restore</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VaultUser({ userId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    filesApi.vaultUser(userId).then(setData).catch((e) => setError(e.message));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  async function open(file) {
    const reason = await appPrompt(`Why do you need to open “${file.name}”? The reason is kept in the audit log.`, { title: "Open a vault file", required: true, placeholder: "e.g. Student lost their phone and asked for their WAEC result", confirmLabel: "Open file" });
    if (!reason) return;
    try {
      const blob = await filesApi.openVaultFile(file.id, reason);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { notify.error(e.message); }
  }
  async function restore(file) {
    try { await filesApi.restoreVaultFile(file.id); notify.success("Restored to their vault. They've been notified."); load(); } catch (e) { notify.error(e.message); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState message="Opening vault index…" />;
  const byFolder = data.folders.map((f) => ({ ...f, files: data.files.filter((x) => x.folderId === f.id) }));
  const daysLeft = (d) => Math.max(0, data.trashDays - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent"><ChevronLeft size={16} /> All vaults</button>
      <div className="acx-vault-head">
        <FolderLock size={20} />
        <div className="min-w-0 flex-1"><p className="font-display text-xl">{data.user.name || data.user.email}</p><p className="text-xs opacity-75">{data.user.email} · {data.files.filter((f) => !f.deletedAt).length} files · {formatBytes(data.files.filter((f) => !f.deletedAt).reduce((a, f) => a + f.size, 0))}</p></div>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-lemon-soft px-3 py-2 text-xs text-midnight"><ShieldAlert size={14} className="mt-0.5 shrink-0" /> You see names only. Opening a file asks for a reason and is written to the audit log (who, when, which file, why).</p>
      {byFolder.length === 0 && <EmptyState icon={FolderLock} title="Empty vault" description="This student hasn't added anything yet." />}
      {byFolder.map((f) => (
        <section key={f.id} className="acx-card">
          <header className="mb-2 flex items-center gap-2">
            <span className={`acx-folder-dot is-${f.color}`} />
            <p className="flex-1 text-sm font-semibold">{f.name}</p>
            {f.deletedAt && <span className="acx-chip-sm is-danger">folder deleted</span>}
            <span className="text-xs text-text-muted">{f.files.length} file{f.files.length === 1 ? "" : "s"}</span>
          </header>
          <ul className="divide-y divide-border-subtle">
            {f.files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 py-2">
                <span className="acx-row-icon !h-9 !w-9"><KindIcon kind={file.kind} /></span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${file.deletedAt ? "text-text-muted line-through" : "text-text-primary"}`}>{file.name}</p>
                  <p className="text-xs text-text-muted">{formatBytes(file.size)} · added {timeAgo(file.createdAt)}{file.deletedAt ? ` · in trash, ${daysLeft(file.deletedAt)} days left` : ""}</p>
                </div>
                {file.deletedAt && <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={() => restore(file)}><ArchiveRestore size={13} /> Restore</button>}
                <button type="button" className="acx-icon-btn" title="Open with a reason" onClick={() => open(file)}><Eye size={15} /></button>
              </li>
            ))}
            {f.files.length === 0 && <li className="py-2 text-xs text-text-muted">Empty folder</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Vaults() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const dq = useDebounced(q);
  const load = useCallback(() => {
    filesApi.vaultUsers({ q: dq }).then((r) => setRows(r.users)).catch((e) => setError(e.message));
  }, [dq]);
  useEffect(() => { load(); }, [load]);

  if (openId) return <VaultUser userId={openId} onBack={() => { setOpenId(null); load(); }} />;
  return (
    <div className="space-y-4">
      <Toolbar q={q} setQ={setQ} placeholder="Student name, email or ID" />
      {error && <ErrorState message={error} onRetry={load} />}
      {!rows && !error && <LoadingState message="Loading vaults…" />}
      {rows && rows.length === 0 && <EmptyState icon={FolderLock} title="No vaults yet" description="Students who set up Academicall Vault appear here." />}
      {rows && rows.length > 0 && (
        <ul className="acx-list">
          {rows.map((r) => (
            <li key={r.user.id} className="acx-row cursor-pointer" onClick={() => setOpenId(r.user.id)}>
              <span className="acx-row-icon"><FolderLock size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.user.name || r.user.email}</p>
                <p className="truncate text-xs text-text-muted">{r.files} files · {formatBytes(r.bytes)}{r.lastUpload ? ` · last added ${timeAgo(r.lastUpload)}` : ""}</p>
              </div>
              {r.trash > 0 && <span className="acx-chip-sm is-lemon">{r.trash} in trash</span>}
              {r.locked && (
                <button type="button" className="acx-btn-ghost !py-1 !text-xs" onClick={async (e) => { e.stopPropagation(); if (await appConfirm(`Unlock ${r.user.name || "this student"}'s vault now? They still need their PIN.`, { confirmLabel: "Unlock" })) { await filesApi.unlockVault(r.user.id); notify.success("Lockout cleared"); load(); } }}>
                  <Unlock size={13} /> Clear lockout
                </button>
              )}
              {!r.locked && <Lock size={14} className="text-text-muted" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DocumentCenter() {
  const { profile } = useAuth();
  const location = useLocation();
  const base = location.pathname.startsWith("/agent") ? "/agent" : "/admin";
  const vaultAllowed = can(profile, "vault.recover");
  const [tab, setTab] = useState("materials");
  const [sum, setSum] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { filesApi.summary().then(setSum).catch((e) => setError(e.message)); }, [tab]);

  const tabs = useMemo(() => [
    { id: "materials", label: "Materials", icon: FileText },
    { id: "group", label: "Group files", icon: Users },
    ...(vaultAllowed ? [{ id: "vault", label: "Vaults", icon: FolderLock }] : []),
  ], [vaultAllowed]);

  if (error) return <ErrorState title="Document Center unavailable" message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Document Center" description="Every upload on Academicall in one place. Find what a student lost, restore what was deleted, and keep materials tidy." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="acx-stat"><p className="acx-stat-n">{sum ? sum.materials.active : "—"}</p><p className="acx-stat-l">Materials live</p><p className="acx-stat-h">{sum ? `${sum.materials.pending} waiting for review` : " "}</p></div>
        <div className="acx-stat"><p className="acx-stat-n">{sum ? sum.groupFiles.active : "—"}</p><p className="acx-stat-l">Group files</p><p className="acx-stat-h">Shared in study groups</p></div>
        <div className="acx-stat is-lemon"><p className="acx-stat-n">{sum ? sum.materials.deleted + sum.groupFiles.deleted : "—"}</p><p className="acx-stat-l">Deleted, restorable</p><p className="acx-stat-h">Materials and group files</p></div>
        {sum?.vault ? (
          <div className="acx-stat is-ink"><p className="acx-stat-n">{sum.vault.files}</p><p className="acx-stat-l">Vault files</p><p className="acx-stat-h">{sum.vault.users} students · {formatBytes(sum.vault.bytes)} · {sum.vault.trash} in trash</p></div>
        ) : (
          <div className="acx-stat"><p className="acx-stat-n"><Lock size={22} /></p><p className="acx-stat-l">Vaults</p><p className="acx-stat-h">Admins only</p></div>
        )}
      </div>

      <div className="acx-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {tab === "materials" && <Materials base={base} profile={profile} />}
      {tab === "group" && <GroupFiles base={base} />}
      {tab === "vault" && vaultAllowed && <Vaults />}
    </div>
  );
}
