import { useMemo, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Upload,
  FileText,
  Loader2,
  Check,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { generateQuestionsFromPdf } from "../lib/geminiGenerate";
import { refreshCbtQuestions } from "../hooks/useCbtData";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

const DIFFICULTIES = [
  { value: "", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function AiGenerateQuestionsModal({
  open,
  onClose,
  courses = [],
  onSaved,
}) {
  const fileRef = useRef(null);

  const [courseId, setCourseId] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) || null,
    [courses, courseId]
  );

  const courseOptions = useMemo(
    () =>
      [...courses].sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""))
      ),
    [courses]
  );

  if (!open) return null;

  function resetAll() {
    setCourseId("");
    setPdfFile(null);
    setCount(10);
    setDifficulty("");
    setTopic("");
    setGenerating(false);
    setSaving(false);
    setError("");
    setGenerated([]);
    setSelected(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    resetAll();
    onClose?.();
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Keep the PDF under 10MB for best results.");
      return;
    }
    setError("");
    setPdfFile(file);
    setGenerated([]);
    setSelected(new Set());
  }

  async function handleGenerate() {
    setError("");
    if (!courseId) return setError("Select a course first.");
    if (!pdfFile) return setError("Upload a PDF of the study material.");
    if (!count || count < 1) return setError("Enter how many questions you want.");

    setGenerating(true);
    setGenerated([]);
    setSelected(new Set());
    try {
      const list = await generateQuestionsFromPdf({
        pdfFile,
        count,
        difficulty,
        topic,
        courseCode: selectedCourse?.code,
        courseTitle: selectedCourse?.title,
      });
      setGenerated(list);
      setSelected(new Set(list.map((_, i) => i)));
    } catch (err) {
      setError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function toggleSelect(idx) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(generated.map((_, i) => i)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function removeOne(idx) {
    setGenerated((prev) => prev.filter((_, i) => i !== idx));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  }

  async function handleSaveSelected() {
    if (!selectedCourse) return setError("Course is required.");
    const toSave = generated.filter((_, i) => selected.has(i));
    if (toSave.length === 0) return setError("Select at least one question to save.");

    setSaving(true);
    setError("");
    try {
      for (const q of toSave) {
        await addDoc(collection(db, "cbtQuestions"), {
          courseCode: selectedCourse.code || "",
          courseTitle: selectedCourse.title || "",
          faculty: selectedCourse.faculty || "",
          department: selectedCourse.department || "",
          level: selectedCourse.level || "",
          topic: q.topic || topic || "General",
          questionText: q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || "",
          difficulty: q.difficulty || "medium",
          source: "ai-gemini",
          createdAt: serverTimestamp(),
        });
      }
      await refreshCbtQuestions();
      onSaved?.(toSave.length);
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to save questions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                AI Generate Questions
              </h2>
              <p className="text-xs text-text-muted">
                Upload a PDF → Gemini creates MCQs with answers & explanations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">Course *</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={fieldClass}
                disabled={generating || saving}
              >
                <option value="">Select course</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-text-muted">
                Number of questions *
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={fieldClass}
                disabled={generating || saving}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-text-muted">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={fieldClass}
                disabled={generating || saving}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value || "mixed"} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">
                Focus topic (optional)
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Chapter 3 – Cell Division"
                className={fieldClass}
                disabled={generating || saving}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">
                Study material (PDF) *
              </label>
              <div
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                  pdfFile
                    ? "border-accent/50 bg-accent-soft/30"
                    : "border-border-strong bg-bg-elevated/50 hover:border-accent/40"
                }`}
              >
                {pdfFile ? (
                  <div className="flex items-center gap-3">
                    <FileText className="text-accent" size={22} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {pdfFile.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="ml-2 rounded-lg p-1.5 text-text-muted hover:bg-bg-panel hover:text-status-danger"
                      disabled={generating || saving}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 text-text-muted" size={24} />
                    <p className="text-sm text-text-secondary">
                      Drop a PDF or click to browse
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Max 10MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFile}
                  className="mt-3 text-xs text-text-muted file:mr-2 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
                  disabled={generating || saving}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {generated.length === 0 && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !courseId || !pdfFile}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Gemini is reading the PDF & writing questions…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate {count} questions with AI
                </>
              )}
            </button>
          )}

          {generated.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">
                  {generated.length} questions generated
                  <span className="ml-2 text-text-muted">
                    ({selected.size} selected)
                  </span>
                </p>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-accent hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="text-text-muted hover:underline"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenerated([]);
                      setSelected(new Set());
                    }}
                    className="text-text-muted hover:underline"
                    disabled={generating || saving}
                  >
                    Generate again
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {generated.map((q, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 transition-colors ${
                      selected.has(idx)
                        ? "border-accent/40 bg-accent-soft/20"
                        : "border-border-subtle bg-bg-elevated/40"
                    }`}
                  >
                    <div className="mb-2 flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(idx)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          selected.has(idx)
                            ? "border-accent bg-accent text-bg-app"
                            : "border-border-strong"
                        }`}
                      >
                        {selected.has(idx) && <Check size={12} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-bg-panel px-1.5 py-0.5 text-[10px] font-bold uppercase text-text-muted">
                            Q{idx + 1}
                          </span>
                          <span className="rounded bg-bg-panel px-1.5 py-0.5 text-[10px] text-text-muted">
                            {q.difficulty}
                          </span>
                          {q.topic && (
                            <span className="rounded bg-bg-panel px-1.5 py-0.5 text-[10px] text-text-muted">
                              {q.topic}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary">
                          {q.questionText}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt, oi) => (
                            <li
                              key={oi}
                              className={`text-xs ${
                                oi === q.correctIndex
                                  ? "font-semibold text-accent"
                                  : "text-text-secondary"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                              {oi === q.correctIndex && " ✓"}
                            </li>
                          ))}
                        </ul>
                        {q.explanation && (
                          <p className="mt-2 text-xs leading-relaxed text-text-muted">
                            <span className="font-medium text-text-secondary">
                              Explanation:{" "}
                            </span>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOne(idx)}
                        className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-bg-panel hover:text-status-danger"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {generated.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-4">
            <p className="text-xs text-text-muted">
              Selected questions will be saved to the course question bank.
            </p>
            <button
              type="button"
              onClick={handleSaveSelected}
              disabled={saving || selected.size === 0}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check size={15} />
                  Save {selected.size} question{selected.size === 1 ? "" : "s"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}