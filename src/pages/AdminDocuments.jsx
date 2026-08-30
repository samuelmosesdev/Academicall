import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Upload, Trash2, Search, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { documentsApi, settingsApi } from "../lib/api";
import { useAdminDocuments } from "../hooks/useAdminDocuments";
import { useCbtData } from "../hooks/useCbtData";
import { uploadDocumentToCloudinary } from "../lib/cloudinaryUpload";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import { titleFromFilename, suggestTags, suggestDescription } from "../lib/documentAi";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

export default function AdminDocuments() {
  const { authMode } = useAuth();
  const { documents, loading } = useAdminDocuments();
  const { courses } = useCbtData();
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [courseId, setCourseId] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState("");
  const [aiSettings, setAiSettings] = useState({
    aiAssistEnabled: true,
    aiAutoTitle: true,
    aiSuggestTags: true,
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authMode === "api") {
      settingsApi.get("general").then(({ value }) => value && setAiSettings((current) => ({ ...current, ...value }))).catch(() => {});
      return;
    }
    const unsub = onSnapshot(doc(db, "appSettings", "general"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setAiSettings({
          aiAssistEnabled: d.aiAssistEnabled !== false,
          aiAutoTitle: d.aiAutoTitle !== false,
          aiSuggestTags: d.aiSuggestTags !== false,
        });
      }
    });
    return unsub;
  }, [authMode]);

  const filterDepartments = useMemo(
    () => departmentsFor(filterFaculty),
    [filterFaculty]
  );

  const courseOptions = useMemo(() => {
    let list = courses;
    if (filterFaculty) list = list.filter((c) => c.faculty === filterFaculty);
    if (filterDepartment) list = list.filter((c) => c.department === filterDepartment);
    return [...list].sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  }, [courses, filterFaculty, filterDepartment]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) || null,
    [courses, courseId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [d.title, d.courseCode, d.courseTitle, d.faculty, d.department, d.level]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    );
  }, [documents, search]);

  // Group list by course for display
  const grouped = useMemo(() => {
    const map = new Map();
    for (const d of filtered) {
      const key = d.courseCode || "UNASSIGNED";
      if (!map.has(key)) {
        map.set(key, {
          courseCode: key,
          courseTitle: d.courseTitle || key,
          faculty: d.faculty,
          department: d.department,
          level: d.level,
          items: [],
        });
      }
      map.get(key).items.push(d);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode)
    );
  }, [filtered]);

  async function handleUpload(e) {
    e.preventDefault();
    setError("");
    if (!selectedCourse) {
      return setError("Select a course from the official list first (Admin → Courses).");
    }
    if (!file) return setError("Choose a PDF first.");
    if (file.type !== "application/pdf") return setError("Only PDF files are supported right now.");
    if (file.size > 10 * 1024 * 1024) return setError("Keep files under 10MB for now.");

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadDocumentToCloudinary(file, setProgress);
      await documentsApi.create({
        title: title.trim() || file.name,
        courseId: selectedCourse.id,
        courseCode: selectedCourse.code,
        courseTitle: selectedCourse.title,
        faculty: selectedCourse.faculty || null,
        department: selectedCourse.department || null,
        level: selectedCourse.level || null,
        tags: tags.length ? tags : null,
        description: description.trim() || null,
        fileUrl: result.secure_url,
        fileName: file.name,
        fileSize: file.size,
      });
      setTitle("");
      setTags([]);
      setDescription("");
      setCourseId("");
      setFilterFaculty("");
      setFilterDepartment("");
      setFile(null);
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete(docItem) {
    const ok = window.confirm(`Remove "${docItem.title}"? This only removes it from the app list.`);
    if (!ok) return;
    try {
      await documentsApi.remove(docItem.id);
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
          <p className="text-sm text-text-secondary">
            Materials are stored under official courses. Add courses first if the list is empty.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong"
        >
          <Upload size={16} />
          {showForm ? "Cancel" : "Upload document"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleUpload}
          className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5"
        >
          <h2 className="text-sm font-semibold text-text-primary">New document</h2>

          {courses.length === 0 && (
            <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              No courses yet. Add them under <strong>Courses</strong> before uploading materials.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Filter by faculty</label>
              <select
                value={filterFaculty}
                onChange={(e) => {
                  setFilterFaculty(e.target.value);
                  setFilterDepartment("");
                  setCourseId("");
                }}
                className={fieldClass}
              >
                <option value="">All faculties</option>
                {FACULTIES.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Filter by department</label>
              <select
                value={filterDepartment}
                onChange={(e) => {
                  setFilterDepartment(e.target.value);
                  setCourseId("");
                }}
                className={fieldClass}
                disabled={!filterFaculty}
              >
                <option value="">All departments</option>
                {filterDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Course *</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={fieldClass}
              required
            >
              <option value="">Select course code</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            {selectedCourse && (
              <p className="mt-1 text-xs text-text-muted">
                {[selectedCourse.faculty, selectedCourse.department, selectedCourse.level]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Document title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 lecture notes"
              className={fieldClass}
            />
          </div>

          {aiSettings.aiAssistEnabled && (
            <div className="space-y-2 rounded-lg border border-accent/30 bg-accent-soft/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                <Sparkles size={13} /> AI assist
              </div>
              <p className="text-[11px] text-text-muted">
                Title auto-fills from the PDF name. Tags follow the selected course. Edit before upload.
              </p>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tg) => (
                    <span key={tg} className="rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary">
                      {tg}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Short description (optional)"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (file && aiSettings.aiAutoTitle) setTitle(titleFromFilename(file.name));
                  if (selectedCourse && aiSettings.aiSuggestTags) {
                    setTags(suggestTags(selectedCourse));
                    setDescription(
                      suggestDescription(selectedCourse, title || titleFromFilename(file?.name || ""))
                    );
                  }
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Re-run AI suggestions
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-text-muted">PDF file *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (!f || !aiSettings.aiAssistEnabled) return;
                if (aiSettings.aiAutoTitle) {
                  setTitle(titleFromFilename(f.name));
                }
                if (aiSettings.aiSuggestTags && selectedCourse) {
                  setTags(suggestTags(selectedCourse));
                  setDescription(suggestDescription(selectedCourse, titleFromFilename(f.name)));
                }
              }}
              className="w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent"
            />
          </div>

          {uploading && (
            <div className="h-2 overflow-hidden rounded-full bg-bg-panel-alt">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && <p className="text-sm text-status-danger">{error}</p>}

          <button
            type="submit"
            disabled={uploading || courses.length === 0}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
          >
            {uploading ? `Uploading… ${progress}%` : "Upload"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:max-w-xs">
        <Search size={15} className="text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {loading && (
        <div className="text-center text-sm text-text-muted">Loading…</div>
      )}

      {!loading && grouped.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-bg-panel px-4 py-8 text-center text-sm text-text-muted">
          <FileText size={28} className="mx-auto mb-2 opacity-50" />
          No documents yet. Upload under a course code.
        </div>
      )}

      <div className="space-y-4">
        {grouped.map((group) => (
          <div
            key={group.courseCode}
            className="overflow-hidden rounded-xl border border-border-subtle bg-bg-panel"
          >
            <div className="border-b border-border-subtle bg-bg-panel-alt px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">
                  {group.courseCode}
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {group.courseTitle}
                </span>
                <span className="text-xs text-text-muted">
                  {group.items.length} file{group.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              {(group.faculty || group.department || group.level) && (
                <p className="mt-0.5 text-xs text-text-muted">
                  {[group.faculty, group.department, group.level].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="divide-y divide-border-subtle">
              {group.items.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">{d.title}</div>
                      <div className="text-xs text-text-muted">
                        {d.fileSize ? `${(d.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-text-secondary hover:text-accent"
                      aria-label="Open"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      className="rounded-lg p-2 text-text-secondary hover:text-status-danger"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
