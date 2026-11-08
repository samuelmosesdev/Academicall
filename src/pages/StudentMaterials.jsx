/**
 * My materials: the student's own library.
 * Upload files, make folders (up to 3 deep), move things around by drag-and-drop
 * or "Move to…", rename, and keep materials saved from the Programme page.
 * Share a file or folder with someone by Unique ID; "Shared" holds what people
 * sent you (accept or decline) and what you've sent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpenText, Check, ChevronRight, Clock, Download, FileText, FileImage, FileSpreadsheet, Presentation,
  Folder, FolderInput, FolderOpen, FolderPlus, Grid2x2, Home, List, Loader2, Lock, MoreHorizontal, Pencil,
  Search, Trash2, Upload, X, AlertCircle, CheckCircle2, GraduationCap, Palette, ArrowUpDown, Share2, Inbox,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { myMaterialsApi, materialSharesApi } from "../lib/myMaterialsApi";
import { useFeatures } from "../lib/features";
import { useRealtime } from "../lib/realtime";
import SubscribeGateModal from "../components/SubscribeGateModal";
import ShareMaterialModal from "../components/materials/ShareMaterialModal";
import SharedMaterials from "../components/materials/SharedMaterials";
import { uploadDocumentToCloudinary } from "../lib/cloudinaryUpload";
import "../materials.css";

const COLORS = ["violet", "lemon", "aqua", "sand", "rose", "ink"];
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*";
const SORTS = { recent: "Newest first", name: "Name A–Z", size: "Largest first" };

/* ── helpers ─────────────────────────────────────────── */
const extOf = (name = "") => (String(name).split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] || "file").toLowerCase();
const sizeLabel = (b) => (!b ? "" : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
const dateLabel = (d) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
function kindOf(ext) {
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return { Icon: FileImage, tone: "aqua", label: "Image" };
  if (["ppt", "pptx", "key"].includes(ext)) return { Icon: Presentation, tone: "lemon", label: "Slides" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, tone: "aqua", label: "Sheet" };
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return { Icon: FileText, tone: "violet", label: "Document" };
  return { Icon: FileText, tone: "rose", label: ext === "pdf" ? "PDF" : ext.toUpperCase() };
}
function toItems(data) {
  const uploads = (data?.uploads || []).map((d) => ({
    key: `u:${d.id}`, type: "upload", id: d.id, title: d.title || d.fileName || "Untitled", fileName: d.fileName, url: d.fileUrl,
    size: d.fileSize || 0, date: d.createdAt, folderId: d.folderId || null, ext: extOf(d.fileName || d.fileUrl),
    href: `/dashboard/reading-hub/doc/${d.id}`,
  }));
  const saves = (data?.saves || []).map((s) => {
    const meta = s.meta || {};
    const code = meta.course?.code || meta.courseCode || "GENERAL";
    return {
      key: `s:${s.id}`, type: "save", id: s.id, title: s.title || meta.title || "Saved material", fileName: meta.fileName, url: s.url || meta.fileUrl || meta.url,
      size: meta.fileSize || 0, date: s.createdAt, folderId: s.folderId || null, ext: extOf(meta.fileName || s.url || meta.fileUrl || ""),
      course: code, courseTitle: meta.course?.title || meta.courseTitle || "",
      href: `/dashboard/materials/library?folder=${encodeURIComponent(code)}&m=${encodeURIComponent(s.id)}`,
    };
  });
  return [...uploads, ...saves];
}

export default function StudentMaterials() {
  const { authMode } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const loc = params.get("f") || "home"; // home | recent | uploads | shared | course:CODE | <folderId>
  const box = params.get("box") === "sent" ? "sent" : "in";
  const { isOn } = useFeatures();
  const sharingOn = isOn("materialSharing");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState(() => localStorage.getItem("mm.sort") || "recent");
  const [view, setView] = useState(() => localStorage.getItem("mm.view") || "grid");
  const [selected, setSelected] = useState(() => new Set());
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [dialog, setDialog] = useState(null); // {kind: 'folder'|'rename'|'move'|'delete', ...}
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(null); // key of open menu
  const [shares, setShares] = useState(null);
  const [sharesError, setSharesError] = useState("");
  const [shareItem, setShareItem] = useState(null);
  const [gate, setGate] = useState(false);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      const result = await myMaterialsApi.overview();
      if (request === loadRequest.current) {
        setData(result);
        setError("");
      }
      return result;
    } catch (e) {
      if (request === loadRequest.current) setError(e.message || "Could not open your materials.");
      return null;
    }
  }, []);
  useEffect(() => { if (authMode !== "firebase") load(); }, [load, authMode]);
  const loadShares = useCallback(() => materialSharesApi.list().then((d) => { setShares(d); setSharesError(""); }).catch((e) => setSharesError(e.message || "Could not open shared materials.")), []);
  useEffect(() => { if (authMode !== "firebase" && sharingOn) loadShares(); }, [loadShares, authMode, sharingOn]);
  useRealtime("notification", (d) => { if (sharingOn && String(d?.kind || "").startsWith("material_share")) loadShares(); });
  useEffect(() => localStorage.setItem("mm.sort", sort), [sort]);
  useEffect(() => localStorage.setItem("mm.view", view), [view]);
  useEffect(() => { setSelected(new Set()); setMenu(null); }, [loc]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const close = () => setMenu(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, []);

  const folders = useMemo(() => data?.folders || [], [data]);
  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const items = useMemo(() => toItems(data), [data]);
  const courses = useMemo(() => {
    const m = new Map();
    items.filter((i) => i.type === "save" && !i.folderId).forEach((i) => {
      const c = m.get(i.course) || { code: i.course, title: i.courseTitle, count: 0 };
      c.count += 1; m.set(i.course, c);
    });
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [items]);
  const countIn = useCallback((fid) => items.filter((i) => i.folderId === fid).length + folders.filter((f) => f.parentId === fid).length, [items, folders]);

  const currentFolder = byId.get(loc) || null;
  const crumbs = useMemo(() => {
    const out = [];
    let f = currentFolder;
    while (f) { out.unshift(f); f = f.parentId ? byId.get(f.parentId) : null; }
    return out;
  }, [currentFolder, byId]);
  const depth = crumbs.length;
  const uploadTarget = currentFolder ? currentFolder.id : null;

  const sortFn = useCallback((a, b) => (sort === "name" ? a.title.localeCompare(b.title) : sort === "size" ? b.size - a.size : new Date(b.date) - new Date(a.date)), [sort]);

  const view$ = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q) {
      return {
        title: `Results for “${term.trim()}”`, folders: folders.filter((f) => f.name.toLowerCase().includes(q)), courses: [],
        files: items.filter((i) => [i.title, i.fileName, i.course].some((v) => String(v || "").toLowerCase().includes(q))).sort(sortFn),
      };
    }
    if (loc === "shared") return { title: "Shared", folders: [], courses: [], files: [] };
    if (loc === "recent") return { title: "Recent", folders: [], courses: [], files: [...items].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40) };
    if (loc === "uploads") return { title: "My uploads", folders: [], courses: [], files: items.filter((i) => i.type === "upload").sort(sortFn) };
    if (loc.startsWith("course:")) {
      const code = loc.slice(7);
      return { title: code, subtitle: courses.find((c) => c.code === code)?.title, folders: [], courses: [], files: items.filter((i) => i.type === "save" && !i.folderId && i.course === code).sort(sortFn) };
    }
    if (currentFolder) {
      return { title: currentFolder.name, folders: folders.filter((f) => f.parentId === currentFolder.id), courses: [], files: items.filter((i) => i.folderId === currentFolder.id).sort(sortFn) };
    }
    return { title: "My Library", folders: folders.filter((f) => !f.parentId), courses, files: items.filter((i) => !i.folderId && i.type === "upload").sort(sortFn) };
  }, [term, loc, items, folders, courses, currentFolder, sortFn]);

  const go = (f) => { setTerm(""); setParams(f === "home" ? {} : { f }); };
  const setBox = (b) => setParams(b === "sent" ? { f: "shared", box: "sent" } : { f: "shared" });
  const pendingShares = shares?.pending || 0;

  /* ── sharing ───────────────────────────────────────── */
  const openShare = (target) => {
    setMenu(null);
    if (shares?.access && !shares.access.canSend && shares.access.premiumRequired) { setGate(true); return; }
    setShareItem(target);
  };
  const shareFile = (it) => openShare({ itemType: it.type, itemId: it.id, title: it.title, meta: kindOf(it.ext).label });
  const shareFolder = (f) => openShare({ itemType: "folder", itemId: f.id, title: f.name, meta: `${countIn(f.id)} item${countIn(f.id) === 1 ? "" : "s"}` });
  const acceptShare = (sh) => run(async () => { await materialSharesApi.accept(sh.id); await loadShares(); }, `Added “${sh.title}” to your materials`);
  const declineShare = (sh) => run(async () => { await materialSharesApi.decline(sh.id); await loadShares(); }, "Declined");
  const cancelShare = (sh) => run(async () => { await materialSharesApi.cancel(sh.id); await loadShares(); }, "Taken back");
  const openAccepted = (sh) => (sh.copiedFolderId && byId.has(sh.copiedFolderId) ? go(sh.copiedFolderId) : go("recent"));
  const upload = data?.upload;

  /* ── uploads ───────────────────────────────────────── */
  async function startUpload(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    if (!upload?.allowed) { setDialog({ kind: "premium" }); return; }
    const maxBytes = (upload.maxFileMb || 25) * 1048576;
    const jobs = files.map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, file, progress: 0, state: file.size > maxBytes ? "error" : "waiting", error: file.size > maxBytes ? `Over ${upload.maxFileMb} MB` : "" }));
    setQueue((q) => [...jobs, ...q]);
    for (const job of jobs.filter((j) => j.state === "waiting")) {
      setQueue((q) => q.map((j) => (j.id === job.id ? { ...j, state: "uploading" } : j)));
      try {
        const up = await uploadDocumentToCloudinary(job.file, (p) => setQueue((q) => q.map((j) => (j.id === job.id ? { ...j, progress: p } : j))));
        const result = await myMaterialsApi.createUpload({
          title: job.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || job.name,
          fileUrl: up.secure_url || up.url, fileName: job.name, fileSize: up.bytes || job.file.size, folderId: uploadTarget,
          source: "personal",
        });
        if (!result?.document?.id) throw new Error("The file uploaded, but it couldn't be added to your library. Refresh and try again.");
        loadRequest.current += 1;
        setData((current) => {
          if (!current) return current;
          const previousUploads = current.uploads || [];
          const alreadyPresent = previousUploads.some((item) => item.id === result.document.id);
          return {
            ...current,
            uploads: alreadyPresent ? previousUploads : [result.document, ...previousUploads],
            upload: current.upload
              ? {
                  ...current.upload,
                  used: alreadyPresent ? current.upload.used : current.upload.used + 1,
                  usedBytes: alreadyPresent
                    ? current.upload.usedBytes
                    : (current.upload.usedBytes || 0) + (result.document.fileSize || job.file.size),
                }
              : current.upload,
          };
        });
        setQueue((q) => q.map((j) => (j.id === job.id ? { ...j, progress: 100, state: "done" } : j)));
      } catch (e) {
        setQueue((q) => q.map((j) => (j.id === job.id ? { ...j, state: "error", error: e.message || "Upload failed" } : j)));
      }
    }
  }

  /* ── actions ───────────────────────────────────────── */
  const run = async (fn, okText) => {
    try { await fn(); setToast({ ok: true, text: okText }); await load(); } catch (e) { setToast({ ok: false, text: e.message || "That didn't work." }); }
  };
  const payload = (keys) => {
    const out = { uploads: [], saves: [], folders: [] };
    keys.forEach((k) => { const [t, id] = [k.slice(0, 1), k.slice(2)]; if (t === "u") out.uploads.push(id); else if (t === "s") out.saves.push(id); else if (t === "f") out.folders.push(id); });
    return out;
  };
  const moveKeys = (keys, folderId) => run(() => myMaterialsApi.move({ ...payload(keys), folderId }), `Moved to ${folderId ? byId.get(folderId)?.name : "My materials"}`).then(() => setSelected(new Set()));
  const removeKeys = (keys) => {
    const p = payload(keys);
    return run(async () => {
      if (p.uploads.length || p.saves.length) await myMaterialsApi.remove({ uploads: p.uploads, saves: p.saves });
      for (const id of p.folders) await myMaterialsApi.deleteFolder(id); // eslint-disable-line no-await-in-loop
    }, keys.length === 1 ? "Deleted" : `${keys.length} items deleted`).then(() => setSelected(new Set()));
  };
  const toggle = (key) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  /* ── drag & drop ───────────────────────────────────── */
  const onDragStart = (e, key) => {
    const keys = selected.has(key) ? [...selected] : [key];
    e.dataTransfer.setData("application/x-mm", JSON.stringify(keys));
    e.dataTransfer.effectAllowed = "move";
  };
  const dropOnFolder = (e, folderId) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove("is-target");
    const raw = e.dataTransfer.getData("application/x-mm");
    if (raw) { const keys = JSON.parse(raw).filter((k) => k !== `f:${folderId}`); if (keys.length) moveKeys(keys, folderId); return; }
    if (e.dataTransfer.files?.length) { dragDepth.current = 0; setDragOver(false); startUploadTo(e.dataTransfer.files, folderId); }
  };
  const startUploadTo = (files, folderId) => { if (folderId !== uploadTarget) { go(folderId || "home"); setTimeout(() => startUpload(files), 0); } else startUpload(files); };
  const targetProps = (folderId) => ({
    onDragOver: (e) => { e.preventDefault(); e.currentTarget.classList.add("is-target"); },
    onDragLeave: (e) => e.currentTarget.classList.remove("is-target"),
    onDrop: (e) => dropOnFolder(e, folderId),
  });
  const pageDrop = {
    onDragEnter: (e) => { if (!e.dataTransfer.types.includes("Files")) return; dragDepth.current += 1; setDragOver(true); },
    onDragLeave: (e) => { if (!e.dataTransfer.types.includes("Files")) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false); },
    onDragOver: (e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); },
    onDrop: (e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); dragDepth.current = 0; setDragOver(false); startUpload(e.dataTransfer.files); },
  };

  /* ── render ────────────────────────────────────────── */
  if (authMode === "firebase") {
    return <div className="mm-empty">Your Library needs the Academicall API account. Sign out and back in to switch.</div>;
  }

  const fileCount = items.length;
  const isEmptyLibrary = data && !folders.length && !items.length;
  const usedPct = upload ? Math.min(100, (upload.used / upload.maxFiles) * 100) : 0;

  return (
    <div className="mm" {...pageDrop}>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink-muted">Library</p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">My <span className="serif-i">library</span></h1>
          <p className="mt-1 text-sm text-ink-muted">{data ? `${folders.length} folder${folders.length === 1 ? "" : "s"} · ${fileCount} file${fileCount === 1 ? "" : "s"}` : "Opening your library…"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.some((i) => i.type === "save") && <Link to="/dashboard/materials/library" className="mm-btn mm-btn--line"><BookOpenText size={16} /> Reading room</Link>}
          <button type="button" className="mm-btn mm-btn--line" onClick={() => setDialog({ kind: "folder", parentId: uploadTarget })} disabled={!data || depth >= 3} title={depth >= 3 ? "Folders can go 3 levels deep" : ""}><FolderPlus size={16} /> New folder</button>
          <button type="button" className="mm-btn mm-btn--ink" onClick={() => (upload?.allowed ? fileInput.current?.click() : setDialog({ kind: "premium" }))} disabled={!data}>
            {upload && !upload.allowed ? <Lock size={16} /> : <Upload size={16} />} Upload
          </button>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { startUpload(e.target.files); e.target.value = ""; }} />
        </div>
      </header>

      {error && <p className="mm-note mm-note--err mt-5"><AlertCircle size={16} /> {error} <button type="button" className="ml-auto font-semibold underline" onClick={load}>Try again</button></p>}

      <div className="mm-shell mt-6">
        {/* Sidebar */}
        <aside className="mm-side" aria-label="Library">
          <nav className="mm-nav">
            <SideLink icon={Home} label="All items" active={loc === "home" && !term} onClick={() => go("home")} drop={targetProps(null)} />
            <SideLink icon={Clock} label="Recent" active={loc === "recent"} onClick={() => go("recent")} />
            <SideLink icon={Upload} label="My uploads" count={items.filter((i) => i.type === "upload").length} active={loc === "uploads"} onClick={() => go("uploads")} />
            {sharingOn && <SideLink icon={Inbox} label="Shared" count={pendingShares} badge={pendingShares > 0} active={loc === "shared" && !term} onClick={() => go("shared")} />}
          </nav>
          <p className="mm-side__label">My folders</p>
          <FolderTree folders={folders} parentId={null} loc={loc} countIn={countIn} go={go} targetProps={targetProps} onDragStart={onDragStart} crumbs={crumbs} />
          {!folders.length && data && <button type="button" className="mm-side__hint" onClick={() => setDialog({ kind: "folder", parentId: null })}><FolderPlus size={14} /> Make your first folder</button>}
          {courses.length > 0 && (
            <>
              <p className="mm-side__label">From your Programme</p>
              <nav className="mm-nav">
                {courses.map((c) => <SideLink key={c.code} icon={GraduationCap} label={c.code} count={c.count} active={loc === `course:${c.code}`} onClick={() => go(`course:${c.code}`)} />)}
              </nav>
            </>
          )}
          {upload && (
            <div className="mm-meter">
              <div className="flex justify-between text-xs"><span className="font-medium text-ink">Your uploads</span><span className="text-ink-muted">{upload.used} of {upload.maxFiles}</span></div>
              <div className="mm-meter__bar"><span style={{ width: `${Math.max(usedPct, 2)}%` }} /></div>
              <p className="text-[0.7rem] text-ink-muted">{sizeLabel(upload.usedBytes) || "0 KB"} used · up to {upload.maxFileMb} MB a file</p>
            </div>
          )}
        </aside>

        {/* Main */}
        <section className="mm-main" aria-live="polite">
          <div className="mm-toolbar">
            <div className="min-w-0 flex-1">
              <nav className="mm-crumbs" aria-label="Folder path">
                <button type="button" onClick={() => go("home")} {...targetProps(null)}>My Library</button>
                {crumbs.map((f) => <span key={f.id} className="contents"><ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => go(f.id)} {...targetProps(f.id)} aria-current={f.id === loc ? "page" : undefined}>{f.name}</button></span>)}
                {!currentFolder && loc !== "home" && !term && <><ChevronRight size={14} aria-hidden="true" /><span className="font-semibold text-ink">{view$.title}</span></>}
              </nav>
              {view$.subtitle && <p className="mt-0.5 text-xs text-ink-muted">{view$.subtitle}</p>}
            </div>
            <label className="mm-search"><Search size={15} aria-hidden="true" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search your Library" aria-label="Search your Library" />{term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search"><X size={14} /></button>}</label>
            {loc !== "shared" && <>
            <label className="mm-select"><ArrowUpDown size={14} aria-hidden="true" /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="mm-seg" role="group" aria-label="View">
              <button type="button" className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2x2 size={15} /></button>
              <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="List view"><List size={15} /></button>
            </div>
            </>}
          </div>

          {/* Mobile folder chips */}
          <div className="mm-chips">
            {[{ id: "home", name: "All" }, { id: "recent", name: "Recent" }, { id: "uploads", name: "Uploads" }, ...(sharingOn ? [{ id: "shared", name: pendingShares ? `Shared · ${pendingShares}` : "Shared" }] : []), ...folders.filter((f) => !f.parentId).map((f) => ({ id: f.id, name: f.name })), ...courses.map((c) => ({ id: `course:${c.code}`, name: c.code }))].map((c) => (
              <button key={c.id} type="button" className={loc === c.id ? "on" : ""} onClick={() => go(c.id)}>{c.name}</button>
            ))}
          </div>

          {loc === "shared" && !term && (
            <SharedMaterials data={shares} error={sharesError} box={box} setBox={setBox} onAccept={acceptShare} onDecline={declineShare} onCancel={cancelShare} onOpen={openAccepted} />
          )}

          {!data && !error && loc !== "shared" && <SkeletonGrid />}

          {data && isEmptyLibrary && !term && loc !== "shared" && (
            <div className="mm-hero-empty">
              <div className="mm-hero-empty__art" aria-hidden="true"><span className="folder-box folder-tone-lemon" /><span className="folder-box folder-tone-violet" /><span className="mm-sheet" /></div>
              <h2 className="font-display text-2xl text-ink">Build your own study library</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">Upload lecture notes, slides, past questions or photos of the board. Make a folder for each course and drag files in. Only you can see them.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" className="mm-btn mm-btn--ink" onClick={() => (upload?.allowed ? fileInput.current?.click() : setDialog({ kind: "premium" }))}><Upload size={16} /> Upload files</button>
                <button type="button" className="mm-btn mm-btn--line" onClick={() => setDialog({ kind: "folder", parentId: null })}><FolderPlus size={16} /> New folder</button>
              </div>
              <p className="mt-4 text-xs text-ink-muted">Tip: you can also drop files anywhere on this page. Items you save from <Link to="/dashboard/department" className="font-semibold text-violet">Programme</Link> show up here too.</p>
            </div>
          )}

          {data && !isEmptyLibrary && (loc !== "shared" || term) && (
            <>
              {(view$.folders.length > 0 || view$.courses.length > 0) && (
                <div className="mt-2">
                  <p className="mm-section">Folders</p>
                  <div className="mm-folders">
                    {view$.folders.map((f) => (
                      <FolderCard key={f.id} f={f} count={countIn(f.id)} selected={selected.has(`f:${f.id}`)} onOpen={() => go(f.id)} onToggle={() => toggle(`f:${f.id}`)}
                        drag={{ draggable: true, onDragStart: (e) => onDragStart(e, `f:${f.id}`), ...targetProps(f.id) }}
                        menuOpen={menu === `f:${f.id}`} setMenu={(open) => setMenu(open ? `f:${f.id}` : null)}
                        actions={[
                          { icon: FolderOpen, label: "Open", run: () => go(f.id) },
                          { icon: Pencil, label: "Rename", run: () => setDialog({ kind: "rename", folder: f }) },
                          { icon: Palette, label: "Colour", run: () => setDialog({ kind: "rename", folder: f, colourOnly: true }) },
                          { icon: FolderInput, label: "Move to…", run: () => setDialog({ kind: "move", keys: [`f:${f.id}`] }) },
                          sharingOn && { icon: Share2, label: "Share…", run: () => shareFolder(f) },
                          { icon: Trash2, label: "Delete folder", danger: true, run: () => setDialog({ kind: "delete", keys: [`f:${f.id}`], folder: f }) },
                        ].filter(Boolean)} />
                    ))}
                    {view$.courses.map((c) => (
                      <button key={c.code} type="button" className="mm-folder mm-folder--course" onClick={() => go(`course:${c.code}`)}>
                        <span className="folder-box folder-tone-sand mm-folder__shape"><span className="mm-folder__badge"><GraduationCap size={12} /> Programme</span></span>
                        <span className="mm-folder__name">{c.code}</span>
                        <span className="mm-folder__meta">{c.count} saved</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <p className="mm-section">{view$.folders.length || view$.courses.length ? "Files" : ""}</p>
                {view$.files.length === 0 ? (
                  <button type="button" className="mm-drop" onClick={() => (upload?.allowed ? fileInput.current?.click() : setDialog({ kind: "premium" }))} disabled={loc === "recent" || loc.startsWith("course:")}>
                    <Upload size={22} aria-hidden="true" />
                    <span className="font-semibold text-ink">{term ? "No files match your search" : loc.startsWith("course:") ? "Nothing left here" : "Drop files here or click to upload"}</span>
                    {!term && !loc.startsWith("course:") && <span className="text-xs text-ink-muted">PDF, Word, slides, sheets or images · up to {upload?.maxFileMb || 25} MB each</span>}
                  </button>
                ) : view === "grid" ? (
                  <div className="mm-files">
                    {view$.files.map((it) => <FileCard key={it.key} it={it} selected={selected.has(it.key)} onToggle={() => toggle(it.key)} drag={{ draggable: true, onDragStart: (e) => onDragStart(e, it.key) }} menuOpen={menu === it.key} setMenu={(o) => setMenu(o ? it.key : null)} actions={fileActions(it, setDialog, sharingOn && shareFile)} showWhere={!!term || loc === "recent" || loc === "uploads"} where={it.folderId ? byId.get(it.folderId)?.name : it.type === "save" ? it.course : "My Library"} />)}
                  </div>
                ) : (
                  <div className="mm-table" role="table">
                    <div className="mm-row mm-row--head" role="row"><span /><span>Name</span><span className="hidden md:block">Location</span><span className="hidden sm:block">Added</span><span className="hidden sm:block text-right">Size</span><span /></div>
                    {view$.files.map((it) => <FileRow key={it.key} it={it} selected={selected.has(it.key)} onToggle={() => toggle(it.key)} drag={{ draggable: true, onDragStart: (e) => onDragStart(e, it.key) }} menuOpen={menu === it.key} setMenu={(o) => setMenu(o ? it.key : null)} actions={fileActions(it, setDialog, sharingOn && shareFile)} where={it.folderId ? byId.get(it.folderId)?.name : it.type === "save" ? it.course : "My Library"} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="mm-overlay" aria-hidden="true">
          <div><Upload size={28} /><p className="mt-3 font-display text-2xl">Drop to upload</p><p className="mt-1 text-sm opacity-75">into {currentFolder ? currentFolder.name : "My Library"}</p></div>
        </div>
      )}

      {/* Selection bar */}
      <div className={`mm-selbar ${selected.size ? "is-on" : ""}`}>
        <span className="text-sm"><b>{selected.size}</b> selected</span>
        <button type="button" className="mm-btn mm-btn--glass" onClick={() => setDialog({ kind: "move", keys: [...selected] })}><FolderInput size={15} /> Move</button>
        <button type="button" className="mm-btn mm-btn--glass" onClick={() => setDialog({ kind: "delete", keys: [...selected] })}><Trash2 size={15} /> Delete</button>
        <button type="button" className="mm-icon" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X size={16} /></button>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && <UploadQueue queue={queue} onClear={() => setQueue((q) => q.filter((j) => j.state === "uploading" || j.state === "waiting"))} />}

      {/* Toast */}
      {toast && <div className={`mm-toast ${toast.ok ? "" : "is-err"}`} role="status">{toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.text}</div>}

      {/* Dialogs */}
      {dialog?.kind === "folder" && <FolderDialog title="New folder" parentName={dialog.parentId ? byId.get(dialog.parentId)?.name : null} onClose={() => setDialog(null)} onSave={(name, color) => run(() => myMaterialsApi.createFolder({ name, color, parentId: dialog.parentId }), `Folder “${name}” created`).then(() => setDialog(null))} />}
      {dialog?.kind === "rename" && dialog.folder && <FolderDialog title={dialog.colourOnly ? "Folder colour" : "Rename folder"} initial={dialog.folder} onClose={() => setDialog(null)} onSave={(name, color) => run(() => myMaterialsApi.updateFolder(dialog.folder.id, { name, color }), "Folder updated").then(() => setDialog(null))} />}
      {dialog?.kind === "rename" && dialog.item && <RenameDialog item={dialog.item} onClose={() => setDialog(null)} onSave={(title) => run(() => (dialog.item.type === "upload" ? myMaterialsApi.renameUpload(dialog.item.id, title) : myMaterialsApi.renameSave(dialog.item.id, title)), "Renamed").then(() => setDialog(null))} />}
      {dialog?.kind === "move" && <MoveDialog folders={folders} keys={dialog.keys} onClose={() => setDialog(null)} onMove={(fid) => moveKeys(dialog.keys, fid).then(() => setDialog(null))} />}
      {dialog?.kind === "delete" && <ConfirmDialog keys={dialog.keys} folder={dialog.folder} items={items} onClose={() => setDialog(null)} onConfirm={() => removeKeys(dialog.keys).then(() => setDialog(null))} />}
      {shareItem && (
        <ShareMaterialModal
          item={shareItem}
          onClose={() => setShareItem(null)}
          onPremium={() => { setShareItem(null); setGate(true); }}
          onSent={(person) => { setShareItem(null); setToast({ ok: true, text: `Sent to ${person.name}` }); loadShares(); }}
        />
      )}
      <SubscribeGateModal open={gate} onClose={() => setGate(false)} feature="Library sharing" />
      {dialog?.kind === "premium" && <PremiumDialog onClose={() => setDialog(null)} onUpgrade={() => navigate("/dashboard/upgrade")} />}
    </div>
  );
}

function fileActions(it, setDialog, onShare) {
  return [
    { icon: BookOpenText, label: "Open", to: it.href },
    it.url && { icon: Download, label: "Download", href: it.url },
    { icon: Pencil, label: "Rename", run: () => setDialog({ kind: "rename", item: it }) },
    { icon: FolderInput, label: "Move to…", run: () => setDialog({ kind: "move", keys: [it.key] }) },
    onShare && { icon: Share2, label: "Share…", run: () => onShare(it) },
    { icon: Trash2, label: it.type === "save" ? "Remove from library" : "Delete", danger: true, run: () => setDialog({ kind: "delete", keys: [it.key] }) },
  ].filter(Boolean);
}

/* ── pieces ─────────────────────────────────────────── */
function SideLink({ icon: Icon, label, count, badge, active, onClick, drop }) {
  return (
    <button type="button" className={`mm-link ${active ? "on" : ""}`} onClick={onClick} {...(drop || {})}>
      <Icon size={16} aria-hidden="true" /><span className="truncate">{label}</span>{count > 0 && <em className={badge ? "mm-badge" : ""}>{count}</em>}
    </button>
  );
}

function FolderTree({ folders, parentId, loc, countIn, go, targetProps, onDragStart, crumbs, level = 0 }) {
  const kids = folders.filter((f) => (f.parentId || null) === parentId);
  if (!kids.length) return null;
  const openIds = new Set(crumbs.map((c) => c.id));
  return (
    <ul className="mm-tree" style={{ "--lvl": level }}>
      {kids.map((f) => (
        <li key={f.id}>
          <button type="button" className={`mm-link ${loc === f.id ? "on" : ""}`} onClick={() => go(f.id)} draggable onDragStart={(e) => onDragStart(e, `f:${f.id}`)} {...targetProps(f.id)}>
            <span className={`mm-dot tone-${f.color}`} aria-hidden="true" />
            <span className="truncate">{f.name}</span>{countIn(f.id) > 0 && <em>{countIn(f.id)}</em>}
          </button>
          {(openIds.has(f.id) || loc === f.id) && <FolderTree folders={folders} parentId={f.id} loc={loc} countIn={countIn} go={go} targetProps={targetProps} onDragStart={onDragStart} crumbs={crumbs} level={level + 1} />}
        </li>
      ))}
    </ul>
  );
}

function Menu({ open, setOpen, actions, label }) {
  return (
    <div className="mm-menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mm-icon mm-icon--soft" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${label}`}><MoreHorizontal size={17} /></button>
      {open && (
        <div className="mm-menu" role="menu">
          {actions.map((a) => {
            const inner = <><a.icon size={15} aria-hidden="true" /> {a.label}</>;
            const cls = `mm-menu__item ${a.danger ? "is-danger" : ""}`;
            if (a.to) return <Link key={a.label} to={a.to} role="menuitem" className={cls}>{inner}</Link>;
            if (a.href) return <a key={a.label} href={a.href} target="_blank" rel="noreferrer" role="menuitem" className={cls}>{inner}</a>;
            return <button key={a.label} type="button" role="menuitem" className={cls} onClick={() => { setOpen(false); a.run(); }}>{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}

function Check$({ on, onToggle, label }) {
  return <button type="button" className={`mm-check ${on ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }} aria-pressed={on} aria-label={`Select ${label}`}>{on && <Check size={12} strokeWidth={3} />}</button>;
}

function FolderCard({ f, count, selected, onOpen, onToggle, drag, menuOpen, setMenu, actions }) {
  return (
    <div className={`mm-folder ${selected ? "is-selected" : ""}`} {...drag} onDoubleClick={onOpen}>
      <button type="button" className={`folder-box folder-tone-${f.color} mm-folder__shape`} onClick={onOpen} aria-label={`Open ${f.name}`}>
        <span className="folder-sheets" aria-hidden="true">{count > 0 && <span />}{count > 1 && <span />}</span>
      </button>
      <Check$ on={selected} onToggle={onToggle} label={f.name} />
      <div className="flex items-start gap-1">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <span className="mm-folder__name">{f.name}</span>
          <span className="mm-folder__meta">{count ? `${count} item${count === 1 ? "" : "s"}` : "Empty"}</span>
        </button>
        <Menu open={menuOpen} setOpen={setMenu} actions={actions} label={f.name} />
      </div>
    </div>
  );
}

function FileCard({ it, selected, onToggle, drag, menuOpen, setMenu, actions, showWhere, where }) {
  const k = kindOf(it.ext);
  return (
    <article className={`mm-file ${selected ? "is-selected" : ""}`} {...drag}>
      <Link to={it.href} className={`mm-file__thumb tone-${k.tone}`}>
        {["png", "jpg", "jpeg", "webp", "gif"].includes(it.ext) && it.url ? <img src={it.url} alt="" loading="lazy" /> : <><k.Icon size={30} strokeWidth={1.5} aria-hidden="true" /><span className="mm-ext">{it.ext}</span></>}
        {it.type === "save" && <span className="mm-tag"><GraduationCap size={11} /> {it.course}</span>}
      </Link>
      <Check$ on={selected} onToggle={onToggle} label={it.title} />
      <div className="flex items-start gap-1 p-3 pt-2.5">
        <Link to={it.href} className="min-w-0 flex-1">
          <p className="mm-file__title" title={it.title}>{it.title}</p>
          <p className="mm-file__meta">{showWhere && where ? <><Folder size={11} className="inline -mt-0.5" /> {where} · </> : null}{k.label}{it.size ? ` · ${sizeLabel(it.size)}` : ""}</p>
        </Link>
        <Menu open={menuOpen} setOpen={setMenu} actions={actions} label={it.title} />
      </div>
    </article>
  );
}

function FileRow({ it, selected, onToggle, drag, menuOpen, setMenu, actions, where }) {
  const k = kindOf(it.ext);
  return (
    <div className={`mm-row ${selected ? "is-selected" : ""}`} role="row" {...drag}>
      <Check$ on={selected} onToggle={onToggle} label={it.title} />
      <Link to={it.href} className="flex min-w-0 items-center gap-3">
        <span className={`mm-row__icon tone-${k.tone}`}><k.Icon size={16} aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{it.title}</span><span className="block text-xs text-ink-muted">{k.label}{it.type === "save" ? ` · saved from ${it.course}` : ""}</span></span>
      </Link>
      <span className="hidden truncate text-sm text-ink-muted md:block">{where}</span>
      <span className="hidden text-sm text-ink-muted sm:block">{dateLabel(it.date)}</span>
      <span className="hidden text-right text-sm tabular-nums text-ink-muted sm:block">{sizeLabel(it.size) || "—"}</span>
      <Menu open={menuOpen} setOpen={setMenu} actions={actions} label={it.title} />
    </div>
  );
}

function UploadQueue({ queue, onClear }) {
  const [min, setMin] = useState(false);
  const active = queue.filter((j) => j.state === "uploading" || j.state === "waiting").length;
  const failed = queue.filter((j) => j.state === "error").length;
  return (
    <div className="mm-queue" role="status">
      <div className="mm-queue__head">
        <p className="text-sm font-semibold">{active ? `Uploading ${active} file${active === 1 ? "" : "s"}…` : failed ? `${failed} upload${failed === 1 ? "" : "s"} failed` : "Uploads complete"}</p>
        <div className="flex items-center gap-1">
          <button type="button" className="mm-icon mm-icon--light" onClick={() => setMin(!min)} aria-label={min ? "Show uploads" : "Hide uploads"}><ChevronRight size={16} className={min ? "-rotate-90" : "rotate-90"} /></button>
          {!active && <button type="button" className="mm-icon mm-icon--light" onClick={onClear} aria-label="Close"><X size={16} /></button>}
        </div>
      </div>
      {!min && (
        <ul className="mm-queue__list">
          {queue.map((j) => (
            <li key={j.id}>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm">{j.name}</span>
                {j.state === "error" ? <span className="text-xs text-[#B42318]">{j.error}</span> : <span className="mm-queue__bar"><span style={{ width: `${j.state === "done" ? 100 : j.progress}%` }} /></span>}
              </span>
              {j.state === "done" ? <CheckCircle2 size={17} className="text-[#05A57E]" /> : j.state === "error" ? <AlertCircle size={17} className="text-[#B42318]" /> : <Loader2 size={17} className="animate-spin text-violet" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="mm-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal__card">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl text-ink">{title}</h2><button type="button" className="mm-icon mm-icon--soft" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function FolderDialog({ title, initial, parentName, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "violet");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); if (!name.trim()) return; setBusy(true); await onSave(name.trim(), color); setBusy(false); };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-5 flex justify-center"><span className={`folder-box folder-tone-${color} block h-20 w-28`} /></div>
        <label className="block text-xs font-medium text-ink">Name<input autoFocus className="mm-input mt-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSC 201 · Data Structures" /></label>
        {parentName && <p className="mt-1.5 text-xs text-ink-muted">Inside {parentName}</p>}
        <p className="mt-4 text-xs font-medium text-ink">Colour</p>
        <div className="mt-2 flex gap-2">{COLORS.map((c) => <button key={c} type="button" className={`mm-swatch tone-${c} ${color === c ? "on" : ""}`} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} />)}</div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Cancel</button><button type="submit" className="mm-btn mm-btn--ink" disabled={busy || !name.trim()}>{busy && <Loader2 size={15} className="animate-spin" />} Save</button></div>
      </form>
    </Modal>
  );
}

function RenameDialog({ item, onClose, onSave }) {
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Rename" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; setBusy(true); await onSave(title.trim()); setBusy(false); }}>
        <input autoFocus className="mm-input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} onFocus={(e) => e.target.select()} />
        {item.type === "save" && <p className="mt-2 text-xs text-ink-muted">Only changes the name in your library. The course material stays the same for everyone else.</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Cancel</button><button type="submit" className="mm-btn mm-btn--ink" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />} Rename</button></div>
      </form>
    </Modal>
  );
}

function MoveDialog({ folders, keys, onClose, onMove }) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const moving = new Set(keys.filter((k) => k.startsWith("f:")).map((k) => k.slice(2)));
  const blocked = (f) => { let cur = f; while (cur) { if (moving.has(cur.id)) return true; cur = folders.find((x) => x.id === cur.parentId); } return false; };
  const rows = [];
  const walk = (pid, lvl) => folders.filter((f) => (f.parentId || null) === pid).forEach((f) => { rows.push({ f, lvl }); walk(f.id, lvl + 1); });
  walk(null, 0);
  return (
    <Modal title={`Move ${keys.length === 1 ? "item" : `${keys.length} items`} to…`} onClose={onClose}>
      <div className="mm-picker">
        <button type="button" className={target === null ? "on" : ""} onClick={() => setTarget(null)}><Home size={15} /> My Library</button>
        {rows.map(({ f, lvl }) => (
          <button key={f.id} type="button" disabled={blocked(f)} className={target === f.id ? "on" : ""} style={{ paddingLeft: `${0.9 + (lvl + 1) * 1.1}rem` }} onClick={() => setTarget(f.id)}>
            <span className={`mm-dot tone-${f.color}`} /> {f.name}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Cancel</button><button type="button" className="mm-btn mm-btn--ink" disabled={busy} onClick={async () => { setBusy(true); await onMove(target); setBusy(false); }}>{busy && <Loader2 size={15} className="animate-spin" />} Move here</button></div>
    </Modal>
  );
}

function ConfirmDialog({ keys, folder, items, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const one = keys.length === 1 ? items.find((i) => i.key === keys[0]) : null;
  const text = folder
    ? `“${folder.name}” will be deleted. Anything inside moves up a level, so you won't lose any files.`
    : one?.type === "save" ? `“${one.title}” will be removed from your library. It stays on the Programme page.`
      : one ? `“${one.title}” will be deleted from your uploads.` : `${keys.length} items will be deleted. Folders' contents move up a level, and saved course materials stay on the Programme page.`;
  return (
    <Modal title={folder ? "Delete folder?" : "Delete?"} onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Cancel</button><button type="button" className="mm-btn mm-btn--danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>{busy && <Loader2 size={15} className="animate-spin" />} Delete</button></div>
    </Modal>
  );
}

function PremiumDialog({ onClose, onUpgrade }) {
  return (
    <Modal title="Uploads are a Premium feature" onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink-muted">Upgrade to upload your own notes, slides and photos, and keep them organised in folders. Items you save from Programme stay free.</p>
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Not now</button><button type="button" className="mm-btn mm-btn--ink" onClick={onUpgrade}><Lock size={15} /> See plans</button></div>
    </Modal>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-4 space-y-6" aria-label="Loading">
      <div className="mm-folders">{[0, 1, 2, 3].map((i) => <div key={i} className="mm-skel h-28" />)}</div>
      <div className="mm-files">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="mm-skel h-44" />)}</div>
    </div>
  );
}
