import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronRight, Download, FileText, FolderInput, FolderPlus, Image as ImageIcon,
  KeyRound, Loader2, Lock, MoreHorizontal, Pencil, ShieldCheck, Trash2, UploadCloud, X,
} from "lucide-react";
import Modal from "../components/Modal";
import { CreatePin, RecoverPin, UnlockPin } from "../components/vault/VaultGate";
import PinPad from "../components/vault/PinPad";
import {
  MAX_FILE_BYTES, VAULT_ACCEPT, VAULT_TYPES, formatBytes, isUnlocked, lockVault, onVaultLockChange, vaultApi,
} from "../lib/vaultApi";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";

const COLORS = [
  { id: "violet", label: "Violet" },
  { id: "aqua", label: "Aqua" },
  { id: "lemon", label: "Lemon" },
  { id: "sand", label: "Sand" },
  { id: "rose", label: "Rose" },
  { id: "midnight", label: "Midnight" },
];
const SUGGESTED = ["Certificates", "Transcripts", "Admission letter", "ID & passport", "School fees receipts", "JAMB & WAEC"];
const IDLE_MS = 5 * 60 * 1000;
const HIDDEN_MS = 60 * 1000;

/**
 * Academicall Vault — PIN-locked, encrypted space for important academic
 * documents. Folders hold photos and PDFs (≤ 5 MB each).
 */
export default function StudentVault() {
  const [status, setStatus] = useState(null);
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [mode, setMode] = useState("pin"); // pin | recover
  const [err, setErr] = useState("");

  const loadStatus = useCallback(async () => {
    setErr("");
    try { setStatus(await vaultApi.status()); }
    catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => onVaultLockChange(setUnlocked), []);
  useAutoLock(unlocked);

  if (err) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border-light bg-card-light p-8 text-center">
        <p className="font-display text-xl text-ink">The vault didn't open</p>
        <p className="mt-2 text-sm text-ink-muted">{err}</p>
        <button type="button" onClick={loadStatus} className="btn-primary mt-5 px-5 py-2.5 text-sm">Try again</button>
      </div>
    );
  }
  if (!status) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Opening your vault…</div>;

  if (!unlocked) {
    const done = () => { setMode("pin"); setStatus((s) => ({ ...s, hasPin: true, locked: false })); };
    if (!status.hasPin) return <CreatePin onDone={done} />;
    if (mode === "recover") return <RecoverPin onDone={done} onBack={() => setMode("pin")} />;
    return <UnlockPin status={status} onDone={done} onForgot={() => setMode("recover")} />;
  }
  return <VaultContents limits={status.limits} />;
}

/** Lock after 5 idle minutes, or a minute after the app goes to the background. */
function useAutoLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    let idle = setTimeout(lockVault, IDLE_MS);
    let hiddenAt = 0;
    const bump = () => { clearTimeout(idle); idle = setTimeout(lockVault, IDLE_MS); };
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_MS) lockVault();
      else bump();
    };
    const tick = setInterval(() => { if (!isUnlocked()) lockVault(); }, 5000);
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(idle); clearInterval(tick);
      ["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", vis);
    };
  }, [active]);
}

function VaultContents({ limits }) {
  const { folderId } = useParams();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  const reload = useCallback(async () => {
    try { setData(await vaultApi.folders()); setLoadErr(""); }
    catch (e) { setLoadErr(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload, folderId]);

  const usage = data?.usage;
  const pct = usage ? Math.min(100, Math.round((usage.bytes / usage.quotaBytes) * 100)) : 0;

  return (
    <div className="space-y-8">
      <header className="vault-hero">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow flex items-center gap-2 text-aqua"><ShieldCheck size={13} /> Encrypted · PIN protected</p>
            <h1 className="mt-2 font-display text-3xl text-white sm:text-4xl">Academicall <span className="serif-i text-lemon">Vault</span></h1>
            <p className="mt-1.5 max-w-md text-sm text-white/60">Certificates, transcripts, admission letters and IDs, all in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setChangingPin(true)} className="vault-chip" title="Change PIN"><KeyRound size={15} /> <span className="hidden sm:inline">PIN</span></button>
            <button type="button" onClick={lockVault} className="vault-chip vault-chip-lemon"><Lock size={15} /> Lock</button>
          </div>
        </div>
        {usage && (
          <div className="relative z-10 mt-6 max-w-md">
            <div className="flex justify-between text-xs text-white/60">
              <span><span className="num text-white">{formatBytes(usage.bytes)}</span> of {formatBytes(usage.quotaBytes)} used</span>
              <span>{usage.files} file{usage.files === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-aqua transition-colors" style={{ width: `${Math.max(pct, usage.bytes ? 2 : 0)}%` }} />
            </div>
          </div>
        )}
      </header>

      {loadErr && <p className="rounded-2xl border border-status-danger/30 bg-status-danger/5 p-4 text-sm text-status-danger">{loadErr}</p>}
      {!data && !loadErr && <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Decrypting your folders…</div>}

      {data && (folderId
        ? <FolderView folderId={folderId} folders={data.folders} limits={limits} onChanged={reload} />
        : <FoldersHome data={data} onCreate={() => setCreating(true)} />)}

      <NewFolderModal open={creating} onClose={() => setCreating(false)} existing={data?.folders || []} onCreated={reload} />
      <ChangePinModal open={changingPin} onClose={() => setChangingPin(false)} />
    </div>
  );
}

function FoldersHome({ data, onCreate }) {
  const { folders, recent } = data;
  return (
    <>
      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-ink-muted">Your folders</p>
            <h2 className="font-display text-2xl text-ink">{folders.length ? `${folders.length} folder${folders.length === 1 ? "" : "s"}` : "Start organising"}</h2>
          </div>
          <button type="button" onClick={onCreate} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"><FolderPlus size={16} /> New folder</button>
        </div>

        {folders.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-14 text-center">
            <div className="folder-box folder-tone-violet mx-auto mb-6 h-24 w-36" aria-hidden />
            <p className="font-display text-xl text-ink">Your vault is empty</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Create a folder for each kind of document, like Certificates or School fees receipts, and add photos or PDFs to it.</p>
            <button type="button" onClick={onCreate} className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">Create your first folder</button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {folders.map((f) => (
              <Link key={f.id} to={`/dashboard/vault/${f.id}`} className={`folder-box folder-tone-${f.color} flex min-h-[150px] flex-col justify-between p-4 sm:min-h-[168px] sm:p-5`}>
                <span className="folder-sheets" aria-hidden>{Array.from({ length: Math.min(2, f.fileCount) }).map((_, i) => <span key={i} />)}</span>
                <div>
                  <Lock size={15} className="mb-2 opacity-50" />
                  <p className="font-display text-lg leading-tight sm:text-xl">{f.name}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="eyebrow opacity-70">{f.fileCount} file{f.fileCount === 1 ? "" : "s"}</span>
                  <span className="opacity-60">{f.bytes ? formatBytes(f.bytes) : "Empty"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recent?.length > 0 && (
        <section>
          <p className="eyebrow text-ink-muted">Recently added</p>
          <div className="mt-3 overflow-hidden rounded-3xl border border-border-light bg-card-light">
            {recent.map((file) => {
              const folder = folders.find((f) => f.id === file.folderId);
              return (
                <Link key={file.id} to={`/dashboard/vault/${file.folderId}?open=${file.id}`} className="flex items-center gap-3 border-b border-border-light px-4 py-3 last:border-0 hover:bg-bg-hover">
                  <FileBadge kind={file.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                    <p className="text-xs text-ink-muted">{folder?.name || "Folder"} · {formatBytes(file.size)}</p>
                  </div>
                  <span className="text-xs text-ink-muted">{new Date(file.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  <ChevronRight size={16} className="text-ink-muted" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function FileBadge({ kind, size = "md" }) {
  const cls = size === "lg" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl";
  return kind === "pdf"
    ? <span className={`${cls} flex shrink-0 items-center justify-center bg-[#ffe1dd] text-[#c4321f]`}><FileText size={size === "lg" ? 22 : 17} /></span>
    : <span className={`${cls} flex shrink-0 items-center justify-center bg-aqua-soft text-aqua-deep`}><ImageIcon size={size === "lg" ? 22 : 17} /></span>;
}

function FolderView({ folderId, folders, limits, onChanged }) {
  const navigate = useNavigate();
  const folder = folders.find((f) => f.id === folderId);
  const [files, setFiles] = useState(null);
  const [uploads, setUploads] = useState([]); // { key, name, progress, error }
  const [viewing, setViewing] = useState(null);
  const [moving, setMoving] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const maxBytes = limits?.maxFileBytes || MAX_FILE_BYTES;

  const load = useCallback(async () => {
    try { const r = await vaultApi.files(folderId); setFiles(r.files); }
    catch (e) { notify.error(e.message); navigate("/dashboard/vault"); }
  }, [folderId, navigate]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get("open");
    if (open && files) { const f = files.find((x) => x.id === open); if (f) setViewing(f); }
  }, [files]);

  async function addFiles(list) {
    const picked = Array.from(list || []);
    for (const file of picked) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      if (!VAULT_TYPES.includes(file.type) && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
        setUploads((u) => [...u, { key, name: file.name, error: "Only photos (JPG, PNG, WEBP) and PDFs" }]);
        continue;
      }
      if (file.size > maxBytes) {
        setUploads((u) => [...u, { key, name: file.name, error: `Over ${formatBytes(maxBytes)}. Compress it first.` }]);
        continue;
      }
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        const r = await vaultApi.upload(folderId, file, (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))));
        setFiles((fs) => [r.file, ...(fs || [])]);
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: e.message } : x)));
      }
    }
    onChanged();
  }

  async function rename(file) {
    const name = await appPrompt("Rename file", { defaultValue: file.name, required: true });
    if (!name || name === file.name) return;
    try { const r = await vaultApi.updateFile(file.id, { name }); setFiles((fs) => fs.map((f) => (f.id === file.id ? r.file : f))); }
    catch (e) { notify.error(e.message); }
  }
  async function remove(file) {
    if (!(await appConfirm(`Delete “${file.name}” from your vault? This can't be undone.`, { tone: "danger", confirmLabel: "Delete" }))) return;
    try { await vaultApi.deleteFile(file.id); setFiles((fs) => fs.filter((f) => f.id !== file.id)); setViewing(null); onChanged(); notify.success("File deleted"); }
    catch (e) { notify.error(e.message); }
  }
  async function download(file) {
    try {
      const url = await vaultApi.blobUrl(file.id);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { notify.error(e.message); }
  }
  async function renameFolder() {
    const name = await appPrompt("Rename folder", { defaultValue: folder.name, required: true });
    if (!name || name === folder.name) return;
    try { await vaultApi.updateFolder(folder.id, { name }); onChanged(); }
    catch (e) { notify.error(e.message); }
  }
  async function deleteFolder() {
    const n = files?.length || 0;
    if (!(await appConfirm(n ? `Delete “${folder.name}” and the ${n} file${n === 1 ? "" : "s"} inside it? This can't be undone.` : `Delete the empty folder “${folder.name}”?`, { tone: "danger", confirmLabel: "Delete folder" }))) return;
    try { await vaultApi.deleteFolder(folder.id); onChanged(); navigate("/dashboard/vault"); notify.success("Folder deleted"); }
    catch (e) { notify.error(e.message); }
  }

  if (!folder) return null;
  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/dashboard/vault" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-light bg-card-light text-ink hover:bg-bg-hover" aria-label="Back to folders"><ArrowLeft size={17} /></Link>
          <div className="min-w-0">
            <p className="eyebrow text-ink-muted">Vault · Folder</p>
            <h2 className="truncate font-display text-2xl text-ink">{folder.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={renameFolder} className="rounded-full border border-border-light bg-card-light p-2.5 text-ink-muted hover:text-ink" title="Rename folder"><Pencil size={15} /></button>
          <button type="button" onClick={deleteFolder} className="rounded-full border border-border-light bg-card-light p-2.5 text-ink-muted hover:text-status-danger" title="Delete folder"><Trash2 size={15} /></button>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"><UploadCloud size={16} /> Add files</button>
          <input ref={inputRef} type="file" accept={VAULT_ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      <button type="button" onClick={() => inputRef.current?.click()} className={`vault-drop mt-5 ${drag ? "is-drag" : ""}`}>
        <UploadCloud size={20} className="text-violet" />
        <span className="text-sm font-medium text-ink">Drop photos or PDFs here, or tap to choose</span>
        <span className="text-xs text-ink-muted">JPG, PNG, WEBP or PDF · up to {formatBytes(maxBytes)} each</span>
      </button>

      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((u) => (
            <div key={u.key} className="flex items-center gap-3 rounded-2xl border border-border-light bg-card-light px-4 py-3">
              {u.error ? <X size={16} className="text-status-danger" /> : <Loader2 size={16} className="animate-spin text-violet" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{u.name}</p>
                {u.error ? <p className="text-xs text-status-danger">{u.error}</p>
                  : <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full bg-violet transition-colors" style={{ width: `${Math.round((u.progress || 0) * 100)}%` }} /></div>}
              </div>
              {u.error && <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))} className="text-xs text-ink-muted hover:text-ink">Dismiss</button>}
            </div>
          ))}
        </div>
      )}

      {!files ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Decrypting…</div>
      ) : files.length === 0 && uploads.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink-muted">Nothing in this folder yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((f) => (
            <FileTile key={f.id} file={f} onOpen={() => setViewing(f)} onRename={() => rename(f)} onMove={() => setMoving(f)} onDelete={() => remove(f)} />
          ))}
        </div>
      )}

      <FileViewer file={viewing} onClose={() => setViewing(null)} onDownload={download} onDelete={remove} />
      <MoveModal
        file={moving}
        folders={folders.filter((f) => f.id !== folderId)}
        onClose={() => setMoving(null)}
        onMoved={(id) => { setFiles((fs) => fs.filter((f) => f.id !== id)); onChanged(); }}
      />
    </section>
  );
}

function useBlobUrl(file, enabled = true) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file || !enabled) return undefined;
    let alive = true;
    let made = null;
    setUrl(null); setError("");
    vaultApi.blobUrl(file.id).then((u) => { made = u; if (alive) setUrl(u); else URL.revokeObjectURL(u); }).catch((e) => alive && setError(e.message));
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [file, enabled]);
  return { url, error };
}

function FileTile({ file, onOpen, onRename, onMove, onDelete }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (file.kind !== "image" || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [file.kind]);
  const { url } = useBlobUrl(file, file.kind === "image" && visible);

  return (
    <div ref={ref} className="vault-tile group">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="vault-thumb">
          {file.kind === "image"
            ? url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={26} className="text-ink-muted/40" />
            : <div className="vault-pdf"><span>PDF</span><i /><i /><i /></div>}
        </div>
        <div className="px-3 pb-3 pt-2.5">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">{formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
        </div>
      </button>
      <button type="button" onClick={() => setMenu((m) => !m)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink shadow-sm" aria-label="File options"><MoreHorizontal size={15} /></button>
      {menu && (
        <div className="absolute right-2 top-10 z-20 w-40 overflow-hidden rounded-2xl border border-border-light bg-card-light py-1 text-sm shadow-xl" onMouseLeave={() => setMenu(false)}>
          <MenuItem icon={Pencil} label="Rename" onClick={() => { setMenu(false); onRename(); }} />
          <MenuItem icon={FolderInput} label="Move" onClick={() => { setMenu(false); onMove(); }} />
          <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setMenu(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}
function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2 hover:bg-bg-hover ${danger ? "text-status-danger" : "text-ink"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function FileViewer({ file, onClose, onDownload, onDelete }) {
  const { url, error } = useBlobUrl(file, !!file);
  useEffect(() => {
    if (!file) return undefined;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [file, onClose]);
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-midnight/95 backdrop-blur-sm" role="dialog" aria-label={file.name}>
      <div className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
        <FileBadge kind={file.kind} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-white/50">{formatBytes(file.size)} · decrypted for you only</p>
        </div>
        <button type="button" onClick={() => onDownload(file)} className="vault-chip"><Download size={15} /> <span className="hidden sm:inline">Download</span></button>
        <button type="button" onClick={() => onDelete(file)} className="vault-chip" aria-label="Delete"><Trash2 size={15} /></button>
        <button type="button" onClick={onClose} className="vault-chip" aria-label="Close"><X size={16} /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        {error ? <p className="text-sm text-white/70">{error}</p>
          : !url ? <Loader2 className="animate-spin text-white/60" />
            : file.kind === "image" ? <img src={url} alt={file.name} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
              : <iframe src={url} title={file.name} className="h-full w-full max-w-4xl rounded-xl bg-white" />}
      </div>
    </div>
  );
}

function NewFolderModal({ open, onClose, existing, onCreated }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const suggestions = useMemo(() => SUGGESTED.filter((s) => !existing.some((f) => f.name.toLowerCase() === s.toLowerCase())).slice(0, 4), [existing]);
  useEffect(() => { if (open) { setName(""); setErr(""); setColor(COLORS[existing.length % COLORS.length].id); } }, [open, existing.length]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await vaultApi.createFolder({ name: name.trim(), color }); onCreated(); onClose(); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New vault folder" size="sm">
      <form onSubmit={submit} className="space-y-5">
        <div className={`folder-box folder-tone-${color} mx-auto flex h-28 w-44 items-end p-4`}>
          <p className="truncate font-display text-lg">{name || "Folder name"}</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-ink">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="e.g. Certificates" className="mt-1.5 w-full rounded-xl border border-border-light bg-card-light px-4 py-2.5 text-sm text-ink outline-none focus:border-violet" />
        </label>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="rounded-full border border-border-light px-3 py-1 text-xs text-ink-muted hover:border-violet hover:text-violet">{s}</button>
            ))}
          </div>
        )}
        <div>
          <span className="text-sm font-medium text-ink">Colour</span>
          <div className="mt-2 flex gap-2.5">
            {COLORS.map((c) => (
              <button key={c.id} type="button" onClick={() => setColor(c.id)} aria-label={c.label} className={`vault-swatch swatch-${c.id} ${color === c.id ? "on" : ""}`}>
                {color === c.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-status-danger">{err}</p>}
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />} Create folder
        </button>
      </form>
    </Modal>
  );
}

function MoveModal({ file, folders, onClose, onMoved }) {
  const [busy, setBusy] = useState(null);
  async function move(id) {
    setBusy(id);
    try { await vaultApi.updateFile(file.id, { folderId: id }); onMoved(file.id); onClose(); notify.success("File moved"); }
    catch (e) { notify.error(e.message); }
    finally { setBusy(null); }
  }
  return (
    <Modal open={!!file} onClose={onClose} title="Move to folder" size="sm">
      {folders.length === 0 ? <p className="text-sm text-ink-muted">Create another folder first.</p> : (
        <div className="space-y-2">
          {folders.map((f) => (
            <button key={f.id} type="button" onClick={() => move(f.id)} disabled={!!busy} className="flex w-full items-center gap-3 rounded-2xl border border-border-light px-4 py-3 text-left hover:bg-bg-hover">
              <span className={`vault-swatch swatch-${f.color} !h-7 !w-7`} />
              <span className="flex-1 text-sm text-ink">{f.name}</span>
              {busy === f.id ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} className="text-ink-muted" />}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ChangePinModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setStep(0); setCur(""); setNext(""); setVal(""); setErr(""); } }, [open]);
  const labels = ["Enter your current PIN", "Choose a new PIN", "Confirm the new PIN"];
  async function complete(p) {
    setErr("");
    if (step === 0) { setCur(p); setVal(""); setStep(1); return; }
    if (step === 1) { setNext(p); setVal(""); setStep(2); return; }
    if (p !== next) { setErr("Those PINs don't match."); setVal(""); setStep(1); return; }
    try { await vaultApi.changePin(cur, p); notify.success("Vault PIN updated"); onClose(); }
    catch (e) { setErr(e.message); setVal(""); setStep(0); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Change vault PIN" size="sm">
      <div className="vault-modal-pad rounded-3xl bg-midnight px-5 py-7 text-center">
        <p className="mb-6 text-sm text-white/70">{labels[step]}</p>
        <PinPad value={val} onChange={(v) => { setVal(v); setErr(""); }} onComplete={complete} error={!!err} />
        <p className="mt-4 min-h-[1.25rem] text-sm text-[#ff8a80]">{err}</p>
      </div>
    </Modal>
  );
}
