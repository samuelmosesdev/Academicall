import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  ListTree,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import useMaterialSaves, { fileExtension, materialKey } from "../hooks/useMaterialSaves";
import { isPdfFile } from "../lib/pdfUtils";
import PdfReader from "../components/reader/PdfReader";
import { useAuth } from "../context/AuthContext";
import { recordDailyActivity, recordMaterialOpen } from "../lib/activity";
import { withDownloadFlag } from "../lib/cloudinaryUpload";
import { isNativeApp } from "../lib/platform";
import { getOfflineObjectUrl, isOfflineAvailable } from "../lib/offlineMaterials";

function viewerFor(item, offlineUrl) {
  if (!item?.fileUrl) return "";
  const extension = fileExtension(item);
  if (offlineUrl) return offlineUrl;
  if (isPdfFile(item)) return item.fileUrl;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) return item.fileUrl;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(item.fileUrl)}&embedded=true`;
}

export default function StudentMaterialsLibrary() {
  const { folders, saves, loading, error } = useMaterialSaves();
  const { user, profile } = useAuth();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const native = isNativeApp();
  const [listOpen, setListOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState(() => new Set());
  const [offlineUrl, setOfflineUrl] = useState(null);

  const ordered = useMemo(() => folders.flatMap((folder) => folder.items), [folders]);
  const currentKey = search.get("m");
  const foundIndex = ordered.findIndex((item) => materialKey(item) === currentKey);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const current = ordered[index];
  const currentFolder = String(current?.courseCode || "GENERAL").toUpperCase();
  const pdf = isPdfFile(current);

  useEffect(() => {
    if (!current) return;
    setOpenFolders((previous) =>
      previous.has(currentFolder) ? previous : new Set(previous).add(currentFolder)
    );
  }, [current, currentFolder]);

  useEffect(() => {
    if (current && materialKey(current) !== currentKey) {
      setSearch({ m: materialKey(current) }, { replace: true });
    }
  }, [current, currentKey, setSearch]);

  useEffect(() => {
    if (user && current?.materialId) {
      recordMaterialOpen(user, current.materialId, profile);
      if (profile) recordDailyActivity(user, profile);
    }
  }, [user, profile, current?.materialId]);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setOfflineUrl(null);
    const id = current?.materialId || current?.id;
    if (!native || !id) return undefined;
    isOfflineAvailable(id)
      .then(async (available) => {
        if (!available || cancelled) return;
        const url = await getOfflineObjectUrl(id);
        if (!cancelled && url) {
          objectUrl = url;
          setOfflineUrl(url);
        }
      })
      .catch((err) => console.error("Could not load the offline material:", err));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [native, current?.id, current?.materialId]);

  function go(item) {
    setSearch({ m: materialKey(item) });
    setListOpen(false);
  }

  function toggleFolder(code) {
    setOpenFolders((previous) => {
      const next = new Set(previous);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 size={16} className="animate-spin" /> Opening the library…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!saves.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-16 text-center">
        <p className="font-display text-xl text-ink">Nothing to read yet</p>
        <p className="mt-2 text-sm text-ink-muted">Save materials from your Programme page and they will appear here.</p>
        <Link to="/dashboard/department" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">
          Browse programme materials
        </Link>
      </div>
    );
  }

  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;
  const source = viewerFor(current, offlineUrl);

  const shelf = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div>
          <p className="eyebrow text-ink-muted">All materials</p>
          <p className="text-sm font-semibold text-ink">
            {folders.length} folders · {ordered.length} files
          </p>
        </div>
        <button
          type="button"
          onClick={() => setListOpen(false)}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-panel-alt lg:hidden"
          aria-label="Close list"
        >
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {folders.map((folder) => {
          const isOpen = openFolders.has(folder.courseCode);
          return (
            <div key={folder.courseCode} className="mb-1">
              <button
                type="button"
                onClick={() => toggleFolder(folder.courseCode)}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-bg-panel-alt"
              >
                <span
                  className={`folder-dot folder-tone-${folder.tone} flex h-7 w-7 items-center justify-center rounded-lg`}
                  style={{ background: "var(--folder-bg)" }}
                >
                  {isOpen ? <FolderOpen size={14} className="text-midnight" /> : <Folder size={14} className="text-midnight" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{folder.courseCode}</span>
                  {folder.courseTitle && (
                    <span className="block truncate text-[11px] text-ink-muted">{folder.courseTitle}</span>
                  )}
                </span>
                <span className="text-[11px] text-ink-muted">{folder.items.length}</span>
                <ChevronDown size={14} className={`text-ink-muted transition ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              {isOpen && (
                <ul className="ml-5 border-l border-border-light pl-2">
                  {folder.items.map((item) => {
                    const active = current && materialKey(item) === materialKey(current);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => go(item)}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] ${
                            active ? "bg-lemon-soft font-semibold text-midnight" : "text-ink hover:bg-bg-panel-alt"
                          }`}
                        >
                          <FileText size={14} className="mt-0.5 shrink-0 opacity-60" />
                          <span className="line-clamp-2">{item.title || "Untitled"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg-app md:static md:z-auto md:h-[calc(100vh-2rem)] md:overflow-hidden md:rounded-2xl md:border md:border-border-light">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-card-light/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard/materials")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-bg-panel-alt hover:text-ink"
            aria-label="Back to Materials"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-light text-ink lg:hidden"
            aria-label="Show all materials"
          >
            <ListTree size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-ink">{current?.title || "Material"}</h1>
            <p className="truncate text-[11px] text-ink-muted">
              {currentFolder} · {index + 1} of {ordered.length}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={!previous}
            onClick={() => previous && go(previous)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-light text-ink disabled:opacity-30"
            aria-label="Previous material"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && go(next)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-light text-ink disabled:opacity-30"
            aria-label="Next material"
          >
            <ChevronRight size={16} />
          </button>
          {current?.fileUrl && (
            <a
              href={current.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open material in a new tab"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border-light px-2.5 text-xs font-medium text-ink hover:border-teal"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">Open file</span>
            </a>
          )}
          {current?.fileUrl && (
            <a
              href={withDownloadFlag(current.fileUrl, current.fileName || current.title) || current.fileUrl}
              download
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-border-light px-2.5 text-xs font-medium text-ink hover:border-teal sm:inline-flex"
            >
              <Download size={14} /> Download
            </a>
          )}
          {current?.materialId && (
            <Link
              to={`/dashboard/reading-hub/doc/${current.materialId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal px-3 text-xs font-semibold text-white"
            >
              <Sparkles size={14} /> <span className="hidden sm:inline">Practice with AI</span>
              <span className="sm:hidden">AI</span>
            </Link>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border-light bg-card-light lg:block">{shelf}</aside>

        {listOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="w-[85%] max-w-sm bg-card-light shadow-2xl">{shelf}</div>
            <button
              type="button"
              className="flex-1 bg-midnight/40"
              aria-label="Close"
              onClick={() => setListOpen(false)}
            />
          </div>
        )}

        <div className="relative min-w-0 flex-1 bg-[#ece8df] dark:bg-[#0b0220]">
          {source && pdf ? (
            <PdfReader key={current?.id} src={source} title={current?.title} />
          ) : source ? (
            <iframe
              key={current?.id}
              title={current?.title || "Material viewer"}
              src={source}
              className="h-full w-full border-0 bg-white"
              allow="fullscreen"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-muted">
              This material has no file attached.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
