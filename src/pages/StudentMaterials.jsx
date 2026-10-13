import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, ExternalLink, FileText, FolderOpen, Loader2, Search, Trash2, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { documentsApi } from "../lib/api";
import { uploadDocumentToCloudinary } from "../lib/cloudinaryUpload";
import { isPro } from "../lib/subscription";
import useMaterialSaves, { folderSlug } from "../hooks/useMaterialSaves";

export default function StudentMaterials() {
  const { user, profile, authMode } = useAuth();
  const { saves, folders, loading, error } = useMaterialSaves();
  const [term, setTerm] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removingId, setRemovingId] = useState(null);
  const canUpload = authMode === "api" && profile?.role === "user" && isPro(profile);

  useEffect(() => {
    if (!canUpload || !user?.uid) {
      setUploads([]);
      setUploadsLoading(false);
      return undefined;
    }
    let alive = true;
    setUploadsLoading(true);
    setUploadsError("");
    documentsApi.mine()
      .then(({ documents: list = [] }) => alive && setUploads(list))
      .catch((err) => alive && setUploadsError(err.message || "Could not load your uploads."))
      .finally(() => alive && setUploadsLoading(false));
    return () => { alive = false; };
  }, [canUpload, user?.uid]);

  async function uploadPersonalMaterial(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploadsError("");
    if (!title.trim() || !file) {
      setUploadsError("Add a title and select a file.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadDocumentToCloudinary(file, setProgress);
      const { document } = await documentsApi.create({
        title: title.trim(),
        fileUrl: uploaded.secure_url || uploaded.url,
        fileName: file.name,
        fileSize: uploaded.bytes || file.size,
      });
      setUploads((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      setTitle("");
      setFile(null);
      form.reset();
    } catch (err) {
      setUploadsError(err.message || "Could not upload this material.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function removeUpload(document) {
    if (!window.confirm(`Delete "${document.title}" from your uploads?`)) return;
    setRemovingId(document.id);
    setUploadsError("");
    try {
      await documentsApi.remove(document.id);
      setUploads((current) => current.filter((item) => item.id !== document.id));
    } catch (err) {
      setUploadsError(err.message || "Could not delete this upload.");
    } finally {
      setRemovingId(null);
    }
  }

  const visible = useMemo(() => {
    const search = term.trim().toLowerCase();
    if (!search) return folders;
    return folders.filter(
      (folder) =>
        folder.courseCode.toLowerCase().includes(search) ||
        (folder.courseTitle || "").toLowerCase().includes(search) ||
        folder.items.some((item) => (item.title || "").toLowerCase().includes(search))
    );
  }, [folders, term]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink-muted">Library</p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            My <span className="serif-i">materials</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {loading
              ? "Opening your folders…"
              : `${folders.length} folder${folders.length !== 1 ? "s" : ""} · ${saves.length} saved material${saves.length !== 1 ? "s" : ""}${canUpload ? ` · ${uploads.length} personal upload${uploads.length !== 1 ? "s" : ""}` : ""}`}
          </p>
        </div>
        {saves.length > 0 && (
          <Link
            to="/dashboard/materials/library"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <BookOpenText size={16} /> Read all materials
          </Link>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {canUpload && (
        <section className="space-y-4 rounded-2xl border border-border-light bg-card-light p-5">
          <div>
            <h2 className="font-display text-xl text-ink">Upload your own material</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Your uploads are listed here for you and won't be shared to your Programme.
            </p>
          </div>
          <form onSubmit={uploadPersonalMaterial} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-xs font-medium text-ink-muted">
              Material title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                required
                className="mt-1 w-full rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm text-ink"
                placeholder="e.g. Lecture notes"
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              File
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                className="mt-1 w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-midnight px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? `Uploading${progress ? ` ${progress}%` : "…"}` : "Upload"}
            </button>
          </form>
          {uploadsError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {uploadsError}
            </p>
          )}
          {uploads.length > 0 && (
            <div className="space-y-2">
              {uploads.map((document) => (
                <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText size={18} className="shrink-0 text-teal" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{document.title}</p>
                      <p className="text-xs text-ink-muted">{document.fileName || "Personal material"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/dashboard/reading-hub/doc/${document.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5 text-xs font-semibold text-teal"
                    >
                      Open <ExternalLink size={13} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeUpload(document)}
                      disabled={removingId === document.id}
                      aria-label={`Delete ${document.title}`}
                      className="rounded-full p-2 text-ink-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {removingId === document.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {authMode === "api" && profile?.role === "user" && !isPro(profile) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-light bg-card-light p-4">
          <p className="text-sm text-ink-muted">Personal material uploads are available with Premium.</p>
          <Link to="/dashboard/upgrade" className="btn-primary px-4 py-2 text-sm">
            Upgrade to Premium
          </Link>
        </div>
      )}

      {folders.length > 3 && (
        <label className="flex max-w-md items-center gap-2 rounded-full border border-border-light bg-card-light px-4 py-2.5 focus-within:border-teal">
          <Search size={16} className="text-ink-muted" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Find a course or a material"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && !error && saves.length === 0 && (!canUpload || (!uploadsLoading && uploads.length === 0)) && (
        <div className="rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-16 text-center">
          <div className="folder-box folder-tone-sand mx-auto mb-6 h-24 w-36" aria-hidden />
          <p className="font-display text-xl text-ink">No folders yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Open <strong>Programme</strong>, find a material from your Course Rep and tap{" "}
            <strong>Save to Materials</strong>. It lands in a folder named after its course.
          </p>
          <Link to="/dashboard/department" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">
            Go to Programme
          </Link>
        </div>
      )}

      {!loading && saves.length > 0 && visible.length === 0 && (
        <p className="text-sm text-ink-muted">Nothing matches “{term}”.</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {visible.map((folder) => (
          <Link
            key={folder.courseCode}
            to={`/dashboard/materials/folder/${folderSlug(folder.courseCode)}`}
            className={`folder-box folder-tone-${folder.tone} flex min-h-[150px] flex-col justify-between p-4 sm:min-h-[170px] sm:p-5`}
            aria-label={`Open ${folder.courseCode} folder`}
          >
            <span className="folder-sheets" aria-hidden>
              {folder.items.slice(0, 2).map((item) => (
                <span key={item.id} />
              ))}
            </span>
            <div>
              <FolderOpen size={18} className="mb-2 opacity-60" />
              <p className="font-display text-xl leading-tight sm:text-2xl">{folder.courseCode}</p>
              {folder.courseTitle && folder.courseTitle !== folder.courseCode && (
                <p className="mt-1 line-clamp-2 break-words text-xs opacity-75">{folder.courseTitle}</p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="eyebrow opacity-70">
                {folder.items.length} file{folder.items.length !== 1 ? "s" : ""}
              </span>
              {folder.lastSaved && (
                <span className="text-[11px] opacity-60">
                  {folder.lastSaved.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
