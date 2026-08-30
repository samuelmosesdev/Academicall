import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import { refreshCbtQuestions } from "../hooks/useCbtData";
import { questionsApi } from "../lib/api";
import { FACULTIES, departmentsFor } from "../data/facultyData";

const TEMPLATE_CSV = `topic,questionText,optionA,optionB,optionC,optionD,correct,difficulty,explanation
Algorithms,What is the time complexity of binary search?,O(n),O(log n),O(n log n),O(1),B,medium,Binary search halves the search space each step.
Algebra,Solve for x: 2x + 4 = 10,x=2,x=3,x=4,x=5,B,easy,2x = 6 so x = 3.
`;

function parseCsv(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      if (current.trim() || lines.length > 0) lines.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) lines.push(current);
  if (lines.length < 2) return [];

  const splitRow = (row) => {
    const cells = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (q && row[i + 1] === '"') { cell += '"'; i++; }
        else q = !q;
      } else if (ch === "," && !q) { cells.push(cell.trim()); cell = ""; }
      else cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (cells.every((c) => !c)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
    rows.push(obj);
  }
  return rows;
}

function normaliseCorrect(val) {
  if (val === undefined || val === null || val === "") return 0;
  const s = String(val).trim().toUpperCase();
  if (s === "A" || s === "0") return 0;
  if (s === "B" || s === "1") return 1;
  if (s === "C" || s === "2") return 2;
  if (s === "D" || s === "3") return 3;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : 0;
}

function rowToPartialQuestion(row) {
  const questionText = (row.questiontext || row.question || row.question_text || "").trim();
  if (!questionText) return null;
  const options = [
    row.optiona || row.option_a || row.a || "",
    row.optionb || row.option_b || row.b || "",
    row.optionc || row.option_c || row.c || "",
    row.optiond || row.option_d || row.d || "",
  ].map((o) => String(o).trim());
  if (options.some((o) => !o)) return null;
  const difficultyRaw = (row.difficulty || "medium").toLowerCase();
  const difficulty = ["easy", "medium", "hard"].includes(difficultyRaw) ? difficultyRaw : "medium";
  return {
    topic: (row.topic || "").trim() || null,
    questionText,
    options,
    correctIndex: normaliseCorrect(row.correct || row.answer || row.correctanswer),
    explanation: (row.explanation || row.explain || "").trim() || null,
    difficulty,
  };
}

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

export default function ImportQuestionsModal({ open, onClose, courses = [] }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [courseId, setCourseId] = useState("");

  const filterDepartments = useMemo(() => departmentsFor(filterFaculty), [filterFaculty]);
  const courseOptions = useMemo(() => {
    let list = courses;
    if (filterFaculty) list = list.filter((c) => c.faculty === filterFaculty);
    if (filterDepartment) list = list.filter((c) => c.department === filterDepartment);
    return [...list].sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [courses, filterFaculty, filterDepartment]);
  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId) || null, [courses, courseId]);

  function reset() {
    setFileName(""); setParsed([]); setErrors([]); setResult(null);
    setCourseId(""); setFilterFaculty(""); setFilterDepartment("");
    if (fileRef.current) fileRef.current.value = "";
  }
  function handleClose() { reset(); onClose?.(); }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        const questions = []; const errs = [];
        rows.forEach((row, i) => {
          const q = rowToPartialQuestion(row);
          if (q) questions.push(q);
          else errs.push(`Row ${i + 2}: missing questionText or one of the options`);
        });
        setParsed(questions); setErrors(errs);
      } catch (err) {
        setParsed([]); setErrors([err.message || "Could not parse file"]);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (!selectedCourse || parsed.length === 0) return;
    setImporting(true); setResult(null);
    let success = 0; let failed = 0;
    try {
      const chunkSize = 400;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        await Promise.all(chunk.map((partial) => questionsApi.create({
            ...partial,
            courseId: selectedCourse.id,
            courseCode: selectedCourse.code,
            courseTitle: selectedCourse.title,
            faculty: selectedCourse.faculty || null,
            department: selectedCourse.department || null,
            level: selectedCourse.level || null,
        })));
        success += chunk.length;
      }
      await refreshCbtQuestions();
      setResult({ success, failed }); setParsed([]); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      failed = parsed.length - success;
      setResult({ success, failed, message: err.message });
    } finally { setImporting(false); }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cbt-questions-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import questions from Excel / CSV">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">Step 1:</strong> Choose the official course.{" "}
          <strong className="text-text-primary">Step 2:</strong> Upload a CSV (Excel → Save as CSV UTF-8).
          Every row is assigned that course code — no typos.
        </p>

        {courses.length === 0 ? (
          <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
            No courses in the system. Add them under <strong>Admin → Courses</strong> first.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel-alt p-3">
            <p className="text-xs font-medium text-text-muted">Select course (required)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={filterFaculty} onChange={(e) => { setFilterFaculty(e.target.value); setFilterDepartment(""); setCourseId(""); }} className={fieldClass}>
                <option value="">All faculties</option>
                {FACULTIES.map((f) => (<option key={f.name} value={f.name}>{f.name}</option>))}
              </select>
              <select value={filterDepartment} onChange={(e) => { setFilterDepartment(e.target.value); setCourseId(""); }} className={fieldClass} disabled={!filterFaculty}>
                <option value="">All departments</option>
                {filterDepartments.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={fieldClass} required>
              <option value="">— Select course code —</option>
              {courseOptions.map((c) => (<option key={c.id} value={c.id}>{c.code} — {c.title}</option>))}
            </select>
            {selectedCourse && (
              <p className="text-xs text-accent">Importing into: {selectedCourse.code} · {selectedCourse.title}</p>
            )}
          </div>
        )}

        <button type="button" onClick={downloadTemplate} className="flex items-center gap-2 text-sm font-medium text-accent hover:underline">
          <FileSpreadsheet size={15} /> Download sample template (.csv)
        </button>

        <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-bg-panel-alt px-4 py-8 transition hover:border-accent ${!selectedCourse ? "pointer-events-none opacity-50" : ""}`}>
          <Upload size={22} className="text-text-muted" />
          <span className="text-sm text-text-secondary">
            {fileName || (selectedCourse ? "Click to choose a .csv file" : "Select a course first")}
          </span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" disabled={!selectedCourse} onChange={handleFile} />
        </label>

        {parsed.length > 0 && (
          <div className="rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary">
            <CheckCircle2 size={14} className="mr-1.5 inline text-accent" />
            Ready to import <strong>{parsed.length}</strong> question{parsed.length !== 1 ? "s" : ""}
            {selectedCourse ? ` into ${selectedCourse.code}` : ""}
          </div>
        )}

        {errors.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
            <AlertCircle size={14} className="mr-1 inline" />
            {errors.slice(0, 8).map((e, i) => (<div key={i}>{e}</div>))}
            {errors.length > 8 && <div>…and {errors.length - 8} more</div>}
          </div>
        )}

        {result && (
          <div className={`rounded-lg px-3 py-2 text-sm ${result.failed ? "border border-status-warning/40 bg-status-warning/10 text-status-warning" : "border border-accent/30 bg-accent-soft text-accent"}`}>
            Imported {result.success} question{result.success !== 1 ? "s" : ""}.
            {result.failed ? ` ${result.failed} failed.` : ""}
            {result.message && ` (${result.message})`}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={handleClose} className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-panel-alt">Close</button>
          <button type="button" disabled={!selectedCourse || parsed.length === 0 || importing} onClick={handleImport} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-50">
            {importing ? "Importing…" : `Import ${parsed.length || ""} questions`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
