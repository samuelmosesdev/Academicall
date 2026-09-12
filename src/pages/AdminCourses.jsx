import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  BookOpen,
  Pencil,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import AiCourseImportModal from "../components/AiCourseImportModal";
import { useAuth } from "../context/AuthContext";
import { coursesApi } from "../lib/api";
import { refreshCbtCourses, useCbtData } from "../hooks/useCbtData";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import {
  downloadSampleCsv,
  parseCsv,
  validateCourseRow,
  normalizeCoursePayload,
} from "../lib/courseImport";

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate", "General"];

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

const emptyForm = {
  code: "",
  title: "",
  faculty: "",
  department: "",
  level: "",
  semester: "",
};

// ---------- Add/Edit Course modal ----------
function CourseFormModal({ open, editingId, form, setForm, saving, error, onClose, onSubmit }) {
  const departments = useMemo(() => departmentsFor(form.faculty), [form.faculty]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            {editingId ? "Edit course" : "Add a course"}
          </h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Course code *</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. CSC 201"
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Course title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Introduction to Computing"
              className={fieldClass}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Faculty *</label>
              <select
                value={form.faculty}
                onChange={(e) => setForm({ ...form, faculty: e.target.value, department: "" })}
                className={fieldClass}
                required
              >
                <option value="">Select faculty</option>
                {FACULTIES.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Department *</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className={fieldClass}
                disabled={!form.faculty}
                required
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Level *</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className={fieldClass}
                required
              >
                <option value="">Select level</option>
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Semester (optional)</label>
              <input
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                placeholder="e.g. Harmattan / Rain"
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Update course" : "Save course"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- Bulk CSV import modal ----------
function ImportModal({ open, onClose, onFile, importMsg, importErrors, importPreview, importing, onApply }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <FileSpreadsheet size={16} className="text-accent" />
            Bulk update from a spreadsheet
          </h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-xs text-text-muted">
          Download the sample, fill it in (or edit an export from Excel), save as CSV, then upload it here.
          Rows matching an existing <strong>course code</strong> get updated; new codes are added.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadSampleCsv()}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-elevated"
          >
            <Download size={14} /> Download sample CSV
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-app hover:bg-accent-strong">
            <Upload size={14} /> Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        </div>

        {importMsg && <p className="mb-3 text-sm text-text-secondary">{importMsg}</p>}

        {importErrors.length > 0 && (
          <div className="mb-3 max-h-32 overflow-y-auto rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
            {importErrors.slice(0, 15).map((e) => (
              <div key={e.rowNum}>Row {e.rowNum} ({e.code || "—"}): {e.issues}</div>
            ))}
            {importErrors.length > 15 && <div>…and {importErrors.length - 15} more</div>}
          </div>
        )}

        {importPreview.length > 0 && (
          <>
            <div className="mb-3 max-h-56 overflow-auto rounded-lg border border-border-subtle">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-elevated text-text-muted">
                  <tr>
                    <th className="px-2 py-1.5">Code</th>
                    <th className="px-2 py-1.5">Title</th>
                    <th className="px-2 py-1.5">Faculty</th>
                    <th className="px-2 py-1.5">Dept</th>
                    <th className="px-2 py-1.5">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle text-text-primary">
                      <td className="px-2 py-1.5 font-medium">{r.code}</td>
                      <td className="px-2 py-1.5">{r.title}</td>
                      <td className="px-2 py-1.5">{r.faculty}</td>
                      <td className="px-2 py-1.5">{r.department}</td>
                      <td className="px-2 py-1.5">{r.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={importing}
              onClick={onApply}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
            >
              {importing ? "Importing…" : `Apply ${importPreview.length} course(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- A single course row ----------
function CourseRow({ c, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg-elevated/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">
          {c.code}
        </span>
        <p className="truncate text-sm text-text-primary">{c.title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {c.level && <span className="text-[11px] text-text-muted">{c.level}</span>}
        <div className="flex gap-1">
          <button type="button" onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-panel hover:text-text-primary" title="Edit">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-panel hover:text-status-danger" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- A collapsible Faculty > Department group ----------
function DepartmentGroup({ department, courses, defaultOpen, onEdit, onDelete }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 bg-bg-elevated px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {department || "No department set"}
        </span>
        <span className="text-xs text-text-muted">{courses.length} course{courses.length === 1 ? "" : "s"}</span>
      </button>
      {open && (
        <div className="divide-y divide-border-subtle bg-bg-panel">
          {courses.map((c) => (
            <CourseRow key={c.id} c={c} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCourses() {
  const { authMode } = useAuth();
  const { courses, loading } = useCbtData();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) =>
      (!filterFaculty || c.faculty === filterFaculty) &&
      (!filterDepartment || c.department === filterDepartment) &&
      (!filterLevel || c.level === filterLevel) &&
      (!q || [c.code, c.title, c.faculty, c.department, c.level]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q)))
    );
  }, [courses, search, filterFaculty, filterDepartment, filterLevel]);

  // Group filtered courses: Faculty -> Department -> [courses], alphabetically,
  // so the list reads like a table of contents instead of a flat dump.
  const grouped = useMemo(() => {
    const byFaculty = new Map();
    for (const c of filtered) {
      const fac = c.faculty || "No faculty set";
      if (!byFaculty.has(fac)) byFaculty.set(fac, new Map());
      const byDept = byFaculty.get(fac);
      const dept = c.department || "No department set";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(c);
    }
    const faculties = [...byFaculty.entries()]
      .map(([faculty, deptMap]) => ({
        faculty,
        total: [...deptMap.values()].reduce((n, arr) => n + arr.length, 0),
        departments: [...deptMap.entries()]
          .map(([department, list]) => ({
            department,
            courses: list.sort((a, b) => (a.code || "").localeCompare(b.code || "")),
          }))
          .sort((a, b) => a.department.localeCompare(b.department)),
      }))
      .sort((a, b) => a.faculty.localeCompare(b.faculty));
    return faculties;
  }, [filtered]);

  const facultyOptions = useMemo(
    () => [...new Set(courses.map((c) => c.faculty).filter(Boolean))].sort(),
    [courses]
  );
  const filterDepartments = useMemo(() => {
    if (filterFaculty) return departmentsFor(filterFaculty);
    return [...new Set(courses.map((c) => c.department).filter(Boolean))].sort();
  }, [courses, filterFaculty]);
  const levelOptions = useMemo(
    () => [...new Set([...LEVELS, ...courses.map((c) => c.level).filter(Boolean)])],
    [courses]
  );

  const hasActiveFilters = Boolean(search || filterFaculty || filterDepartment || filterLevel);
  // Auto-expand groups only when actively filtering/searching, so a big
  // catalogue stays collapsed and scannable by default.
  const autoExpand = hasActiveFilters;

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c) {
    setForm({
      code: c.code || "",
      title: c.title || "",
      faculty: c.faculty || "",
      department: c.department || "",
      level: c.level || "",
      semester: c.semester || "",
    });
    setEditingId(c.id);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.code.trim()) return setError("Course code is required (e.g. CSC 201).");
    if (!form.title.trim()) return setError("Course title is required.");
    if (!form.faculty) return setError("Select a faculty.");
    if (!form.department) return setError("Select a department.");
    if (!form.level) return setError("Select a level.");

    const payload = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      faculty: form.faculty,
      department: form.department,
      level: form.level,
      semester: form.semester.trim() || null,
    };

    const duplicate = courses.find(
      (c) => c.code?.toUpperCase() === payload.code && c.id !== editingId
    );
    if (duplicate) return setError(`Course code ${payload.code} already exists.`);

    setSaving(true);
    try {
      if (editingId) await coursesApi.update(editingId, payload);
      else await coursesApi.create(payload);
      if (authMode === "api") await refreshCbtCourses();
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Failed to save course.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c) {
    const ok = window.confirm(
      `Remove course ${c.code} — ${c.title}? Existing questions with this code will still work, but the dropdown will no longer list it.`
    );
    if (!ok) return;
    try {
      await coursesApi.remove(c.id);
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }

  async function onExcelFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setImportMsg("");
    setImportErrors([]);
    setImportPreview([]);
    if (!file) return;

    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      setImportMsg(
        "Please open the file in Excel and Save As → CSV (Comma delimited) (*.csv), then upload that CSV. Sample download is CSV and opens in Excel."
      );
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        setImportMsg("No data rows found. Check the header row matches the sample.");
        return;
      }
      const errs = [];
      const ok = [];
      for (const row of rows) {
        const ve = validateCourseRow(row);
        if (ve.length) errs.push({ rowNum: row.rowNum, code: row.code, issues: ve.join(", ") });
        else ok.push(row);
      }
      setImportPreview(ok);
      setImportErrors(errs);
      setImportMsg(`Parsed ${rows.length} row(s): ${ok.length} ready, ${errs.length} with issues.`);
    } catch (err) {
      setImportMsg(err.message || "Could not read file.");
    }
  }

  async function applyImport() {
    if (!importPreview.length) return;
    setImporting(true);
    setImportMsg("");
    try {
      const byCode = new Map(courses.map((c) => [String(c.code || "").toUpperCase(), c]));
      let added = 0;
      let updated = 0;
      for (const row of importPreview) {
        const payload = normalizeCoursePayload(row);
        const existing = byCode.get(payload.code);
        if (existing) {
          await coursesApi.update(existing.id, payload);
          updated += 1;
        } else {
          await coursesApi.create(payload);
          added += 1;
        }
      }
      if (authMode === "api") await refreshCbtCourses();
      setImportMsg(`Import complete: ${added} added, ${updated} updated.`);
      setImportPreview([]);
      setImportErrors([]);
    } catch (err) {
      setImportMsg(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setFilterFaculty("");
    setFilterDepartment("");
    setFilterLevel("");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Courses</h1>
          <p className="text-sm text-text-secondary">
            The fixed course list per faculty & department. CBT Builder and Excel import use only what's here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated"
          >
            <FileSpreadsheet size={15} /> Import from CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAiImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated"
          >
            <Sparkles size={15} /> AI import (image/PDF)
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong"
          >
            <Plus size={16} /> Add course
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-3.5">
          <div className="text-xl font-bold text-text-primary">{courses.length}</div>
          <div className="text-xs text-text-muted">Total courses</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-3.5">
          <div className="text-xl font-bold text-text-primary">{facultyOptions.length}</div>
          <div className="text-xs text-text-muted">Faculties covered</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-3.5">
          <div className="text-xl font-bold text-accent">
            {new Set(courses.map((c) => c.department).filter(Boolean)).size}
          </div>
          <div className="text-xs text-text-muted">Departments</div>
        </div>
      </div>

      {/* Compact filter bar — search + 3 dropdowns on one line, not a whole card */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-bg-panel p-3">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-bg-app px-3 py-2">
          <Search size={14} className="shrink-0 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, title, faculty…"
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <select
          value={filterFaculty}
          onChange={(e) => { setFilterFaculty(e.target.value); setFilterDepartment(""); }}
          className="rounded-lg border border-border-subtle bg-bg-app px-2.5 py-2 text-sm text-text-primary"
        >
          <option value="">All faculties</option>
          {facultyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-app px-2.5 py-2 text-sm text-text-primary"
        >
          <option value="">All departments</option>
          {filterDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-app px-2.5 py-2 text-sm text-text-primary"
        >
          <option value="">All levels</option>
          {levelOptions.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-bg-elevated"
          >
            Clear
          </button>
        )}
      </div>

      {/* Course list, grouped by Faculty then Department */}
      <div className="space-y-4">
        {loading && (
          <div className="rounded-xl border border-border-subtle bg-bg-panel px-4 py-10 text-center text-sm text-text-muted">
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-border-subtle bg-bg-panel px-4 py-10 text-center text-sm text-text-muted">
            <BookOpen size={28} className="mx-auto mb-2 opacity-50" />
            {hasActiveFilters ? "No courses match these filters." : "No courses yet. Add the official list so CBT questions use fixed codes."}
          </div>
        )}
        {!loading && grouped.map((facGroup) => (
          <div key={facGroup.faculty} className="rounded-xl border border-border-subtle bg-bg-app p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <FolderOpen size={15} className="text-accent" />
                {facGroup.faculty}
              </h3>
              <span className="text-xs text-text-muted">{facGroup.total} course{facGroup.total === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-2">
              {facGroup.departments.map((deptGroup) => (
                <DepartmentGroup
                  key={deptGroup.department}
                  department={deptGroup.department}
                  courses={deptGroup.courses}
                  defaultOpen={autoExpand || facGroup.departments.length === 1}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <CourseFormModal
        open={showForm}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        error={error}
        onClose={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
        onSubmit={handleSubmit}
      />

      <ImportModal
        open={showBulkImport}
        onClose={() => { setShowBulkImport(false); setImportMsg(""); setImportErrors([]); setImportPreview([]); }}
        onFile={onExcelFile}
        importMsg={importMsg}
        importErrors={importErrors}
        importPreview={importPreview}
        importing={importing}
        onApply={applyImport}
      />

      <AiCourseImportModal
        open={showAiImport}
        onClose={() => setShowAiImport(false)}
        mode="direct"
        onDone={() => {}}
      />
    </div>
  );
}
