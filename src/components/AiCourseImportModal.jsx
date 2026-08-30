import { useState } from "react";
import { Sparkles, Upload, X, Loader2, Check } from "lucide-react";
import { coursesApi, requestsApi } from "../lib/api";
// Static import — dynamic import broke on production (chunk fetch failed)
import {
  validateCourseRow,
  normalizeCoursePayload,
} from "../lib/courseImport";
import { useAuth } from "../context/AuthContext";
import { extractCoursesFromFile } from "../lib/geminiGenerate";

/**
 * mode: "direct" = write to courses (admin/agent)
 * mode: "request" = Course Rep → requests for admin approval
 */
export default function AiCourseImportModal({
  open,
  onClose,
  mode = "direct",
  defaultFaculty = "",
  defaultDepartment = "",
  onDone,
  onImported,
  studentMode = false,
}) {
  const effectiveMode = studentMode ? "student" : mode;
  const { user, profile } = useAuth();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  if (!open) return null;

  async function runExtract() {
    setError("");
    setMsg("");
    if (!file) return setError("Choose an image or PDF first.");
    setBusy(true);
    try {
      let list = await extractCoursesFromFile(file);
      // Course Rep: force their department
      if (mode === "request" && defaultDepartment) {
        list = list.map((r) => ({
          ...r,
          department: r.department || defaultDepartment,
          faculty: r.faculty || defaultFaculty || "",
        }));
      }
      setRows(list);
      if (!list.length) setError("No courses detected. Try a clearer image/PDF.");
    } catch (e) {
      const msg = e?.message || "Extract failed";
      if (/api key|VITE_GEMINI|API_KEY/i.test(msg)) {
        setError("Gemini API key missing. Add VITE_GEMINI_API_KEY to .env / hosting env, then rebuild & redeploy.");
      } else if (/Failed to fetch dynamically imported module/i.test(msg)) {
        setError("AI module failed to load. Redeploy the site after updating AiCourseImportModal (static import fix).");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveDirect() {
    setSaving(true);
    setError("");
    try {
      const valid = [];
      const errs = [];
      rows.forEach((r, i) => {
        const e = validateCourseRow(r);
        if (e.length) errs.push(`Row ${i + 1}: ${e.join(", ")}`);
        else valid.push(normalizeCoursePayload(r));
      });
      if (!valid.length) {
        setError(errs[0] || "No valid rows");
        setSaving(false);
        return;
      }
      await Promise.all(valid.map((payload) => coursesApi.create({
        ...payload,
        published: true,
        source: "ai-import",
      })));
      setMsg(`Imported ${valid.length} course(s).`);
      onDone?.();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveAsRequest() {
    setSaving(true);
    setError("");
    try {
      await requestsApi.create({
        type: "course_bulk",
        status: "pending",
        title: `AI course import (${rows.length} courses) — ${defaultDepartment}`,
        details: "Extracted from image/PDF by Course Rep",
        requesterUid: user.uid,
        requesterName: profile?.name || user.email,
        requesterEmail: user.email,
        requesterRole: "courseRep",
        payload: {
          courses: rows.map((r) =>
            normalizeCoursePayload({
              ...r,
              department: r.department || defaultDepartment,
              faculty: r.faculty || defaultFaculty,
            })
          ),
        },
      });
      setMsg("Sent to Admin for approval (Course Reps tab).");
      onDone?.();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e.message || "Request failed");
    } finally {
      setSaving(false);
    }
  }


  async function saveStudent() {
    setSaving(true);
    setError("");
    try {
      const normalized = rows.map((r) =>
        normalizeCoursePayload({
          ...r,
          department: r.department || defaultDepartment,
          faculty: r.faculty || defaultFaculty,
        })
      );
      onImported?.(normalized);
      setMsg("Courses added to your list.");
      onDone?.();
      setTimeout(onClose, 800);
    } catch (e) {
      setError(e.message || "Could not apply courses");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (effectiveMode === "student") return saveStudent();
    if (effectiveMode === "request") return saveAsRequest();
    return saveDirect();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-bg-panel p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Sparkles size={18} className="text-accent" /> AI import courses
          </h2>
          <button type="button" onClick={onClose} className="text-text-muted">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Upload a timetable / handbook image or PDF. AI builds the same fields as
          CSV: code, title, faculty, department, level, semester.
        </p>

        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-3 block w-full text-sm"
        />

        <button
          type="button"
          disabled={busy || !file}
          onClick={runExtract}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Extract with AI
        </button>

        {error && <p className="mb-2 text-sm text-status-danger">{error}</p>}
        {msg && <p className="mb-2 text-sm text-accent">{msg}</p>}

        {rows.length > 0 && (
          <>
            <p className="mb-2 text-xs text-text-muted">{rows.length} course(s) detected</p>
            <div className="mb-3 max-h-48 overflow-auto rounded-lg border border-border-subtle text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-elevated text-left text-text-muted">
                    <th className="p-2">Code</th>
                    <th className="p-2">Title</th>
                    <th className="p-2">Dept</th>
                    <th className="p-2">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      <td className="p-2 font-medium">{r.code}</td>
                      <td className="p-2">{r.title}</td>
                      <td className="p-2">{r.department}</td>
                      <td className="p-2">{r.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg-app"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {effectiveMode === "request"
                ? "Submit for admin approval"
                : effectiveMode === "student"
                  ? "Add to my courses"
                  : "Import to courses"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
