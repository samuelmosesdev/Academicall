import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Search,
  ClipboardList,
  FileSpreadsheet,
} from "lucide-react";
import { db } from "../firebase/config";
import { useCbtData, refreshCbtQuestions } from "../hooks/useCbtData";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import ImportQuestionsModal from "../components/ImportQuestionsModal";

const DIFFICULTIES = ["easy", "medium", "hard"];

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

const emptyForm = {
  courseId: "",
  topic: "",
  questionText: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  difficulty: "medium",
};

export default function AdminCbtBuilder() {
  const { courses, questions, practiceSets, loading } = useCbtData({ withQuestions: true });
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filterDepartments = useMemo(
    () => departmentsFor(filterFaculty),
    [filterFaculty]
  );

  const courseOptions = useMemo(() => {
    let list = courses;
    if (filterFaculty) list = list.filter((c) => c.faculty === filterFaculty);
    if (filterDepartment) list = list.filter((c) => c.department === filterDepartment);
    return [...list].sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [courses, filterFaculty, filterDepartment]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === form.courseId) || null,
    [courses, form.courseId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item) =>
      [item.courseCode, item.courseTitle, item.topic, item.questionText, item.faculty]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q))
    );
  }, [questions, search]);

  function updateOption(idx, value) {
    setForm((prev) => {
      const options = [...prev.options];
      options[idx] = value;
      return { ...prev, options };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.courseId || !selectedCourse) {
      return setError("Select a course from the list. Add courses under Admin → Courses first.");
    }
    if (!form.questionText.trim()) return setError("Question text is required.");
    if (form.options.some((o) => !o.trim())) return setError("All four options are required.");

    setSaving(true);
    try {
      await addDoc(collection(db, "cbtQuestions"), {
        courseId: selectedCourse.id,
        courseCode: selectedCourse.code,
        courseTitle: selectedCourse.title,
        topic: form.topic.trim() || null,
        faculty: selectedCourse.faculty || null,
        department: selectedCourse.department || null,
        level: selectedCourse.level || null,
        questionText: form.questionText.trim(),
        options: form.options.map((o) => o.trim()),
        correctIndex: Number(form.correctIndex),
        explanation: form.explanation.trim() || null,
        difficulty: form.difficulty,
        createdAt: serverTimestamp(),
      });
      await refreshCbtQuestions();
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Failed to save question.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q) {
    const ok = window.confirm(`Delete this question from ${q.courseCode}?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "cbtQuestions", q.id));
      await refreshCbtQuestions();
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">CBT Builder</h1>
          <p className="text-sm text-text-secondary">
            Questions are tied to the official course list. Manage courses under{" "}
            <span className="text-accent">Admin → Courses</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-panel-alt"
          >
            <FileSpreadsheet size={16} />
            Import Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong"
          >
            <Plus size={16} />
            {showForm ? "Cancel" : "Add Question"}
          </button>
        </div>
      </div>

      <ImportQuestionsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        courses={courses}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">{questions.length}</div>
          <div className="text-xs text-text-muted">Total questions</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">{practiceSets.length}</div>
          <div className="text-xs text-text-muted">Course codes in use</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-accent">{courses.length}</div>
          <div className="text-xs text-text-muted">Official courses</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">
            {practiceSets.filter((s) => s.questionCount >= 10).length}
          </div>
          <div className="text-xs text-text-muted">Sets with 10+ Qs</div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5"
        >
          <h2 className="text-sm font-semibold text-text-primary">New question</h2>

          {courses.length === 0 && (
            <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              No courses yet. Go to <strong>Admin → Courses</strong> and add the official list first.
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
                  setForm((f) => ({ ...f, courseId: "" }));
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
                  setForm((f) => ({ ...f, courseId: "" }));
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Course *</label>
              <select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
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
              <label className="mb-1 block text-xs text-text-muted">Topic (optional)</label>
              <input
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g. Algorithms"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className={fieldClass}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Question text *</label>
            <textarea
              value={form.questionText}
              onChange={(e) => setForm({ ...form, questionText: e.target.value })}
              rows={3}
              placeholder="Type the full question here…"
              className={fieldClass}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {form.options.map((opt, idx) => (
              <div key={idx}>
                <label className="mb-1 block text-xs text-text-muted">
                  Option {String.fromCharCode(65 + idx)} *
                  {form.correctIndex === idx && (
                    <span className="ml-2 text-accent">(correct)</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className={fieldClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, correctIndex: idx })}
                    className={`shrink-0 rounded-lg border px-3 text-xs font-medium ${
                      form.correctIndex === idx
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border-subtle text-text-muted hover:border-accent"
                    }`}
                  >
                    Correct
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Explanation (optional)</label>
            <textarea
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              rows={2}
              placeholder="Shown after the student submits…"
              className={fieldClass}
            />
          </div>

          {error && <p className="text-sm text-status-danger">{error}</p>}

          <button
            type="submit"
            disabled={saving || courses.length === 0}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Question"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:max-w-xs">
        <Search size={15} className="text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-panel">
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-text-muted">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            <ClipboardList size={28} className="mx-auto mb-2 opacity-50" />
            No questions yet. Select a course from the official list and add one.
          </div>
        )}
        {filtered.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">
                  {q.courseCode}
                </span>
                {q.topic && <span className="text-[11px] text-text-muted">{q.topic}</span>}
                {q.difficulty && (
                  <span className="rounded-full border border-border-subtle px-1.5 py-0.5 text-[10px] capitalize text-text-muted">
                    {q.difficulty}
                  </span>
                )}
                {q.level && <span className="text-[11px] text-text-muted">{q.level}</span>}
              </div>
              <p className="text-sm text-text-primary line-clamp-2">{q.questionText}</p>
              <p className="mt-1 text-xs text-text-muted">
                Correct: {String.fromCharCode(65 + (q.correctIndex ?? 0))}.{" "}
                {q.options?.[q.correctIndex ?? 0]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(q)}
              className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-status-danger"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
