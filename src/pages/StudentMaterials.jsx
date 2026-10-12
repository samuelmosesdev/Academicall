import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, FolderOpen, Loader2, Search } from "lucide-react";
import useMaterialSaves, { folderSlug } from "../hooks/useMaterialSaves";

export default function StudentMaterials() {
  const { saves, folders, loading, error } = useMaterialSaves();
  const [term, setTerm] = useState("");

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
              : `${folders.length} folder${folders.length !== 1 ? "s" : ""} · ${saves.length} material${saves.length !== 1 ? "s" : ""}, sorted by course code`}
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

      {!loading && !error && saves.length === 0 && (
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
