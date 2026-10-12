import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpenText, ChevronRight, Loader2, Trash2 } from "lucide-react";
import useMaterialSaves, { fileExtension, materialKey, toDate } from "../hooks/useMaterialSaves";
import { isNativeApp } from "../lib/platform";
import { listOfflineMaterials, removeMaterialOffline, saveMaterialOffline } from "../lib/offlineMaterials";

export default function StudentMaterialFolder() {
  const { courseCode: raw } = useParams();
  const courseCode = String(raw || "GENERAL").toUpperCase();
  const { folders, loading, error, remove } = useMaterialSaves();
  const folder = folders.find((item) => item.courseCode === courseCode);
  const [removing, setRemoving] = useState(null);
  const native = isNativeApp();
  const [offlineIds, setOfflineIds] = useState(() => new Set());
  const [offlineBusyId, setOfflineBusyId] = useState(null);

  useEffect(() => {
    if (!native) return undefined;
    listOfflineMaterials()
      .then((list) => setOfflineIds(new Set(list.map((item) => item.id))))
      .catch((err) => console.error("Could not list offline materials:", err));
    return undefined;
  }, [native]);

  async function onRemove(item) {
    if (!window.confirm(`Remove “${item.title || "this material"}” from ${courseCode}?`)) return;
    setRemoving(item.id);
    try {
      await remove(item.id);
    } catch (err) {
      alert(err.message || "Could not remove.");
    } finally {
      setRemoving(null);
    }
  }

  async function onToggleOffline(item) {
    const id = item.materialId || item.id;
    if (!item.fileUrl) {
      alert("No file URL for this material.");
      return;
    }
    setOfflineBusyId(id);
    try {
      if (offlineIds.has(id)) {
        await removeMaterialOffline(id);
        setOfflineIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      } else {
        await saveMaterialOffline({
          id,
          title: item.title,
          fileUrl: item.fileUrl,
          courseCode: item.courseCode,
          fileName: item.fileName || item.title,
        });
        setOfflineIds((current) => new Set(current).add(id));
      }
    } catch (err) {
      alert(err.message || "Could not save offline. Connect once to download.");
    } finally {
      setOfflineBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/dashboard/materials" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={15} /> Materials
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-ink">{courseCode}</span>
      </nav>

      <header
        className={`folder-box folder-tone-${folder?.tone || "lemon"} flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7`}
        style={{ transform: "none" }}
      >
        <div>
          <p className="eyebrow opacity-70">Folder</p>
          <h1 className="font-display text-3xl sm:text-4xl">{courseCode}</h1>
          {folder?.courseTitle && folder.courseTitle !== courseCode && (
            <p className="mt-1 text-sm opacity-75">{folder.courseTitle}</p>
          )}
          <p className="mt-2 text-xs opacity-70">
            {folder ? `${folder.items.length} material${folder.items.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {folder?.items.length > 0 && (
          <Link
            to={`/dashboard/materials/library?folder=${encodeURIComponent(courseCode)}&m=${materialKey(folder.items[0])}`}
            className="inline-flex items-center gap-2 rounded-full bg-midnight px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <BookOpenText size={16} /> Read this folder
          </Link>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && !error && !folder && (
        <div className="rounded-2xl border border-border-light bg-card-light p-8 text-center text-sm text-ink-muted">
          This folder is empty or no longer exists.{" "}
          <Link to="/dashboard/materials" className="font-semibold text-teal">
            Back to all folders
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {folder?.items.map((item, index) => {
          const extension = fileExtension(item);
          const offlineId = item.materialId || item.id;
          const savedAt = toDate(item.savedAt);
          const readUrl = `/dashboard/materials/library?folder=${encodeURIComponent(courseCode)}&m=${materialKey(item)}`;
          return (
            <article key={item.id} className="file-sheet flex min-h-[150px] flex-col justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-midnight px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-lemon">
                    {extension}
                  </span>
                  <span className="eyebrow text-ink-muted">No. {String(index + 1).padStart(2, "0")}</span>
                </div>
                <Link to={readUrl} className="mt-3 block pr-4 text-[15px] font-semibold leading-snug text-ink hover:text-teal">
                  {item.title || "Untitled material"}
                </Link>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{item.description}</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-ink-muted">
                  {savedAt ? `Saved ${savedAt.toLocaleDateString()}` : "Saved"}
                </span>
                <div className="flex items-center gap-1.5">
                  {native && item.fileUrl && (
                    <button
                      type="button"
                      onClick={() => onToggleOffline(item)}
                      disabled={offlineBusyId === offlineId}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        offlineIds.has(offlineId)
                          ? "border-teal/40 bg-teal-soft text-teal"
                          : "border-border-light text-ink"
                      }`}
                    >
                      {offlineBusyId === offlineId ? "…" : offlineIds.has(offlineId) ? "Offline ✓" : "Offline"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    disabled={removing === item.id}
                    aria-label="Remove material"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-status-danger/10 hover:text-status-danger"
                  >
                    {removing === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                  <Link to={readUrl} className="rounded-full bg-teal px-3 py-1 text-[11px] font-semibold text-white">
                    Read
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
