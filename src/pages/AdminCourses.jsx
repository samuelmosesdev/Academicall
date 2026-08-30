import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, BookOpen, Pencil, X, Upload, Download, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  const departments = useMemo(() => departmentsFor(form.faculty), [form.faculty]);

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

  const filterDepartments = useMemo(() => {
    if (filterFaculty) return departmentsFor(filterFaculty);
    return [...new Set(courses.map((c) => c.department).filter(Boolean))].sort();
  }, [courses, filterFaculty]);

  const facultyOptions = useMemo(
    () => [...new Set(courses.map((c) => c.faculty).filter(Boolean))].sort(),
    [courses]
  );
  const levelOptions = useMemo(
    () => [...new Set([...LEVELS, ...courses.map((c) => c.level).filter(Boolean)])].sort(),
    [courses]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedCourses = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filterFaculty, filterDepartment, filterLevel]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function countFor(key, value) {
    return courses.filter((course) => course[key] === value).length;
  }

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

    // Prevent duplicate codes (except when editing the same doc)
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
      setImportMsg(
        `Parsed ${rows.length} row(s): ${ok.length} ready, ${errs.length} with issues.`
      );
    } catch (err) {
      setImportMsg(err.message || "Could not read file.");
    }
  }

  async function applyImport() {
    if (!importPreview.length) return;
    setImporting(true);
    setImportMsg("");
    try {
      const byCode = new Map(
        courses.map((c) => [String(c.code || "").toUpperCase(), c])
      );
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Courses</h1>
          <p className="text-sm text-text-secondary">
            Fixed course list per faculty & department. CBT Builder and Excel import use this list only.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong"
        >
          <Plus size={16} />
          Add Course
        </button>
        <button
          type="button"
          onClick={() => setShowAiImport(true)}
          className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated"
        >
          <Upload size={16} />
          AI import (image/PDF)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">{courses.length}</div>
          <div className="text-xs text-text-muted">Total courses</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">
            {new Set(courses.map((c) => c.faculty).filter(Boolean)).size}
          </div>
          <div className="text-xs text-text-muted">Faculties covered</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-accent">
            {new Set(courses.map((c) => c.department).filter(Boolean)).size}
          </div>
          <div className="text-xs text-text-muted">Departments</div>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-panel p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Course distribution</h2>
          <p className="mt-1 text-xs text-text-muted">Choose a faculty, department, or level to see its course count.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Faculty", value: filterFaculty, setValue: setFilterFaculty, options: facultyOptions, key: "faculty" },
            { label: "Department", value: filterDepartment, setValue: setFilterDepartment, options: filterDepartments, key: "department" },
            { label: "Level", value: filterLevel, setValue: setFilterLevel, options: levelOptions, key: "level" },
          ].map((group) => (
            <label key={group.key} className="min-w-0 rounded-lg border border-border-subtle bg-bg-app p-3">
              <span className="mb-1 block text-xs font-medium text-text-muted">{group.label}</span>
              <select
                value={group.value}
                onChange={(e) => group.setValue(e.target.value)}
                className={`${fieldClass} min-w-0`}
              >
                <option value="">All {group.label.toLowerCase()}s ({courses.length})</option>
                {group.options.map((option) => (
                  <option key={option} value={option}>{option} ({countFor(group.key, option)})</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      
      {/* Excel / CSV bulk import */}
      <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <FileSpreadsheet size={16} className="text-accent" />
              Update courses from Excel
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Download the sample, edit in Excel (add rows), Save As CSV, then upload. Matching{" "}
              <strong>course codes</strong> are updated; new codes are added.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadSampleCsv()}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-elevated"
            >
              <Download size={14} /> Download sample
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-app hover:bg-accent-strong">
              <Upload size={14} /> Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onExcelFile} />
            </label>
          </div>
        </div>

        {importMsg && <p className="text-sm text-text-secondary">{importMsg}</p>}

        {importErrors.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
            {importErrors.slice(0, 15).map((e) => (
              <div key={e.rowNum}>
                Row {e.rowNum} ({e.code || "—"}): {e.issues}
              </div>
            ))}
            {importErrors.length > 15 && <div>…and {importErrors.length - 15} more</div>}
          </div>
        )}

        {importPreview.length > 0 && (
          <>
            <div className="max-h-48 overflow-auto rounded-lg border border-border-subtle">
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
              onClick={applyImport}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
            >
              {importing ? "Importing…" : `Apply ${importPreview.length} course(s)`}
            </button>
          </>
        )}
      </div>

{showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              {editingId ? "Edit course" : "New course"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">Course title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Introduction to Computing"
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Faculty *</label>
              <select
                value={form.faculty}
                onChange={(e) =>
                  setForm({ ...form, faculty: e.target.value, department: "" })
                }
                className={fieldClass}
                required
              >
                <option value="">Select faculty</option>
                {FACULTIES.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
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
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
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
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
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

          {error && <p className="text-sm text-status-danger">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Update Course" : "Save Course"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:max-w-xs">
        <Search size={15} className="text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses…"
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-panel">
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-text-muted">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            <BookOpen size={28} className="mx-auto mb-2 opacity-50" />
            No courses yet. Add the official list so CBT questions use fixed codes.
          </div>
        )}
        {pagedCourses.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">
                  {c.code}
                </span>
                {c.level && (
                  <span className="text-[11px] text-text-muted">{c.level}</span>
                )}
              </div>
              <p className="text-sm font-medium text-text-primary">{c.title}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {[c.faculty, c.department].filter(Boolean).join(" · ")}
                {c.semester ? ` · ${c.semester}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(c)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-status-danger"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} courses
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="whitespace-nowrap text-sm font-medium text-text-primary">Page {page} of {pageCount}</span>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      <AiCourseImportModal
        open={showAiImport}
        onClose={() => setShowAiImport(false)}
        mode="direct"
        onDone={() => {}}
      />
    </div>
  );
}
