/**
 * Staff view of one user's My materials: their folders (nested) and the files in
 * each, read-only. Files open in a new tab.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, FileText, Folder, FolderOpen, GraduationCap, Layers, Loader2 } from "lucide-react";
import { userMaterialsApi } from "../../lib/myMaterialsApi";

const sizeLabel = (b) => (!b ? "" : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
const dateLabel = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function FileLine({ f }) {
  const inner = (
    <>
      <FileText size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{f.title}</span>
      {f.type === "save" && <span className="hidden shrink-0 items-center gap-1 text-xs text-text-muted sm:inline-flex"><GraduationCap size={12} /> {f.course || "Saved"}</span>}
      <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-text-muted sm:block">{sizeLabel(f.size) || "—"}</span>
      <span className="hidden w-24 shrink-0 text-right text-xs text-text-muted md:block">{dateLabel(f.createdAt)}</span>
      {f.url && <ExternalLink size={13} className="shrink-0 text-text-muted" aria-hidden="true" />}
    </>
  );
  return f.url
    ? <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-primary hover:bg-bg-elevated" title={`Open ${f.title}`}>{inner}</a>
    : <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-text-primary">{inner}</div>;
}

function FolderNode({ folder, folders, files, level }) {
  const [open, setOpen] = useState(false);
  const kids = folders.filter((f) => f.parentId === folder.id);
  const inside = files.filter((f) => f.folderId === folder.id);
  const total = kids.length + inside.length;
  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-elevated">
        <ChevronRight size={14} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
        {open ? <FolderOpen size={15} className="shrink-0 text-accent" aria-hidden="true" /> : <Folder size={15} className="shrink-0 text-accent" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{folder.name}</span>
        <span className="shrink-0 text-xs text-text-muted">{total ? `${total} item${total === 1 ? "" : "s"}` : "Empty"}</span>
      </button>
      {open && total > 0 && (
        <ul className="ml-[0.85rem] border-l border-border-subtle pl-2">
          {kids.map((k) => <FolderNode key={k.id} folder={k} folders={folders} files={files} level={level + 1} />)}
          {inside.map((f) => <li key={`${f.type}:${f.id}`}><FileLine f={f} /></li>)}
        </ul>
      )}
    </li>
  );
}

export default function UserMaterialsPanel({ userId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showLoose, setShowLoose] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null); setError("");
    userMaterialsApi.get(userId).then((d) => live && setData(d)).catch((e) => live && setError(e.message || "Couldn't load their Library."));
    return () => { live = false; };
  }, [userId]);

  const { folders, files, top, loose } = useMemo(() => {
    const fs = data?.folders || [];
    const all = data?.files || [];
    const ids = new Set(fs.map((f) => f.id));
    return {
      folders: fs,
      files: all,
      top: fs.filter((f) => !f.parentId || !ids.has(f.parentId)),
      loose: all.filter((f) => !f.folderId || !ids.has(f.folderId)),
    };
  }, [data]);

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-panel p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Layers size={16} /> Library</h2>
        {data && <span className="text-xs text-text-muted">{folders.length} folder{folders.length === 1 ? "" : "s"} · {files.length} file{files.length === 1 ? "" : "s"} · read-only</span>}
      </div>
      {error && <p className="text-sm text-status-danger">{error}</p>}
      {!data && !error && <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
      {data && !folders.length && !files.length && <p className="text-sm text-text-muted">No folders or files in their Library yet.</p>}
      {data && (folders.length > 0 || files.length > 0) && (
        <ul className="space-y-0.5">
          {top.map((f) => <FolderNode key={f.id} folder={f} folders={folders} files={files} level={0} />)}
          {loose.length > 0 && (
            <li>
              <button type="button" onClick={() => setShowLoose((v) => !v)} aria-expanded={showLoose} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-elevated">
                <ChevronRight size={14} className={`shrink-0 text-text-muted transition-transform ${showLoose ? "rotate-90" : ""}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate italic text-text-secondary">Not in a folder</span>
                <span className="shrink-0 text-xs text-text-muted">{loose.length} file{loose.length === 1 ? "" : "s"}</span>
              </button>
              {showLoose && <ul className="ml-[0.85rem] border-l border-border-subtle pl-2">{loose.map((f) => <li key={`${f.type}:${f.id}`}><FileLine f={f} /></li>)}</ul>}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
