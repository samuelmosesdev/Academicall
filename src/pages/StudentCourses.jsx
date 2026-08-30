import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  BookOpen,
  Check,
  Crown,
  Loader2,
  Plus,
  Sparkles,
  Star,
  Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCbtData } from "../hooks/useCbtData";
import { FREE_LIMITS, isPro } from "../lib/subscription";
import { db } from "../firebase/config";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import AiCourseImportModal from "../components/AiCourseImportModal";
import { usersApi } from "../lib/api";
import { logActivity } from "../lib/activityLog";

export default function StudentCourses() {
  const { user, profile, authMode } = useAuth();
  const { courses, loading } = useCbtData();
  const pro = isPro(profile);
  const [selected, setSelected] = useState(() => profile?.selectedCourseIds || []);
  const [customCourses, setCustomCourses] = useState(
    () => profile?.customCourses || []
  );
  const [faculty, setFaculty] = useState(profile?.faculty || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAi, setShowAi] = useState(false);

  const [manualCode, setManualCode] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (profile?.selectedCourseIds) setSelected(profile.selectedCourseIds);
    if (profile?.customCourses) setCustomCourses(profile.customCourses);
  }, [profile?.selectedCourseIds, profile?.customCourses]);

  const departments = useMemo(() => departmentsFor(faculty), [faculty]);

  const { recommended, suggestions } = useMemo(() => {
    let list = [...courses];
    const dep = profile?.department || department;
    const fac = profile?.faculty || faculty;
    if (!pro) {
      if (fac) list = list.filter((c) => !c.faculty || c.faculty === fac);
      if (dep) list = list.filter((c) => !c.department || c.department === dep);
    } else {
      if (faculty) list = list.filter((c) => c.faculty === faculty);
      if (department) list = list.filter((c) => c.department === department);
    }
    list.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));

    const recommended = list.filter(
      (c) => c.source === "courseRep" || c.uploadedByRole === "courseRep"
    );
    const suggestions = list.filter(
      (c) => c.source !== "courseRep" && c.uploadedByRole !== "courseRep"
    );
    return { recommended, suggestions };
  }, [courses, pro, faculty, department, profile?.faculty, profile?.department]);

  const selectedFromCatalog = useMemo(
    () => courses.filter((c) => selected.includes(c.id)),
    [courses, selected]
  );

  const totalSelected =
    selectedFromCatalog.length +
    customCourses.filter((c) => c.enabled !== false).length;

  const max = pro ? Infinity : FREE_LIMITS.maxCourses;

  function toggle(id) {
    setMsg("");
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (totalSelected >= max) {
        setMsg(
          pro
            ? ""
            : `Free plan allows only ${FREE_LIMITS.maxCourses} courses. Upgrade to Pro for unlimited.`
        );
        return prev;
      }
      return [...prev, id];
    });
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setMsg("");
    try {
      if (authMode === "api") {
        await usersApi.updateMe({ selectedCourseIds: selected, customCourses });
      } else {
        await updateDoc(doc(db, "users", user.uid), {
          selectedCourseIds: selected,
          customCourses,
        });
      }
      setMsg("Your course list was saved.");
    } catch (err) {
      setMsg(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addManual(e) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    const title = manualTitle.trim();
    if (!code || !title) return;
    if (totalSelected >= max) {
      setMsg(
        pro
          ? ""
          : `Free plan allows only ${FREE_LIMITS.maxCourses} courses. Upgrade to Pro.`
      );
      return;
    }
    if (
      customCourses.some((c) => c.code === code) ||
      courses.some((c) => c.code === code && selected.includes(c.id))
    ) {
      setMsg("That course code is already on your list.");
      return;
    }
    setAdding(true);
    try {
      const entry = {
        code,
        title,
        source: "self",
        faculty: profile?.faculty || faculty || null,
        department: profile?.department || department || null,
        enabled: true,
        addedAt: new Date().toISOString(),
      };
      const next = [...customCourses, entry];
      setCustomCourses(next);
      if (user) {
        if (authMode === "api") {
          await usersApi.updateMe({ customCourses: next });
        } else {
          await updateDoc(doc(db, "users", user.uid), { customCourses: next });
        }
      }
      setManualCode("");
      setManualTitle("");
      setMsg(`Added ${code} to your courses.`);
    } catch (err) {
      setMsg(err.message || "Could not add course.");
    } finally {
      setAdding(false);
    }
  }

  function removeCustom(code) {
    const next = customCourses.filter((c) => c.code !== code);
    setCustomCourses(next);
  }

  async function handleAiCourses(extracted) {
    if (!Array.isArray(extracted) || !extracted.length) return;
    const room = max - totalSelected;
    if (room <= 0) {
      setMsg("Course limit reached. Upgrade or remove some courses first.");
      return;
    }
    const toAdd = [];
    for (const item of extracted.slice(0, room)) {
      const code = String(item.code || item.courseCode || "")
        .trim()
        .toUpperCase();
      const title = String(item.title || item.courseTitle || code).trim();
      if (!code) continue;
      if (
        customCourses.some((c) => c.code === code) ||
        toAdd.some((c) => c.code === code)
      )
        continue;
      toAdd.push({
        code,
        title,
        source: "ai",
        faculty: profile?.faculty || faculty || null,
        department: profile?.department || department || null,
        enabled: true,
        addedAt: new Date().toISOString(),
      });
    }
    if (!toAdd.length) {
      setMsg("No new courses found in the registration document.");
      return;
    }
    const next = [...customCourses, ...toAdd];
    setCustomCourses(next);
    try {
      if (user) {
        await usersApi.updateMe({ customCourses: next });
        await logActivity({
          actorUid: user.uid,
          actorName: profile?.name || user.email,
          action: "courses.ai_import",
          reference: `${toAdd.length} courses`,
          meta: { codes: toAdd.map((c) => c.code) },
        });
      }
      setMsg(`Imported ${toAdd.length} course(s) from your registration.`);
    } catch (e) {
      setMsg(e.message || "Imported locally but could not persist.");
    }
    setShowAi(false);
  }

  const fieldClass =
    "rounded-lg border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

  function CourseCard({ c, badge }) {
    const on = selected.includes(c.id);
    return (
      <button
        type="button"
        onClick={() => toggle(c.id)}
        className={`rounded-xl border p-4 text-left transition ${
          on
            ? "border-teal bg-teal-soft/50 ring-1 ring-teal/30"
            : "border-border-light bg-card-light hover:border-teal/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-teal">{c.code}</p>
              {badge}
            </div>
            <p className="mt-0.5 text-sm font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {[c.faculty, c.department, c.level].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              on ? "bg-teal text-white" : "border border-border-light text-transparent"
            }`}
          >
            <Check size={14} />
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">My Courses</h1>
          <p className="text-sm text-ink-muted">
            Add courses yourself, import from course registration with AI, or pick from
            recommendations.
            {!pro && ` Free plan: up to ${FREE_LIMITS.maxCourses} courses.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft px-3 py-2 text-xs font-semibold text-teal hover:bg-teal hover:text-white"
          >
            <Sparkles size={13} /> AI course reg
          </button>
          {!pro && (
            <Link
              to="/dashboard/upgrade"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
            >
              <Crown size={13} /> Go Pro
            </Link>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border-light bg-card-light p-4">
        <h2 className="text-sm font-semibold text-ink">
          Selected ({totalSelected}
          {!pro ? ` / ${FREE_LIMITS.maxCourses}` : ""})
        </h2>
        {totalSelected === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No courses yet. Add manually, import with AI, or pick below.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selectedFromCatalog.map((c) => (
              <li
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1 text-xs font-medium text-teal"
              >
                <BookOpen size={12} />
                {c.code} — {c.title}
              </li>
            ))}
            {customCourses.map((c) => (
              <li
                key={c.code}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                <BookOpen size={12} />
                {c.code} — {c.title}
                <span className="opacity-70">
                  ({c.source === "ai" ? "AI" : "self"})
                </span>
                <button
                  type="button"
                  onClick={() => removeCustom(c.code)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Save selection
        </button>
        {msg && <p className="mt-2 text-sm text-ink-muted">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-border-light bg-card-light p-4">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Plus size={15} /> Add a course yourself
        </h2>
        <form onSubmit={addManual} className="mt-3 flex flex-wrap gap-2">
          <input
            className={fieldClass + " w-28"}
            placeholder="Code e.g. CSC201"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <input
            className={fieldClass + " min-w-[180px] flex-1"}
            placeholder="Course title"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <select
          value={faculty}
          onChange={(e) => {
            setFaculty(e.target.value);
            setDepartment("");
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
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className={fieldClass}
          disabled={!faculty}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading courses…</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Star size={15} className="text-amber-500" />
          Recommended
          <span className="text-xs font-normal text-ink-muted">
            (from your Course Rep)
          </span>
        </h2>
        {!loading && recommended.length === 0 && (
          <p className="text-xs text-ink-muted">
            No course-rep recommendations for this filter yet.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {recommended.map((c) => (
            <CourseCard
              key={c.id}
              c={c}
              badge={
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  Recommended
                </span>
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Lightbulb size={15} className="text-teal" />
          Suggestions
          <span className="text-xs font-normal text-ink-muted">
            (platform catalogue)
          </span>
        </h2>
        {!loading && suggestions.length === 0 && (
          <div className="rounded-xl border border-border-light bg-card-light px-4 py-8 text-center text-sm text-ink-muted">
            <BookOpen className="mx-auto mb-2 opacity-50" size={28} />
            No catalogue courses match this filter.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((c) => (
            <CourseCard
              key={c.id}
              c={c}
              badge={
                <span className="rounded-full bg-teal-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal">
                  Suggestion
                </span>
              }
            />
          ))}
        </div>
      </section>

      {showAi && (
        <AiCourseImportModal
          open={showAi}
          onClose={() => setShowAi(false)}
          onImported={handleAiCourses}
          studentMode
        />
      )}
    </div>
  );
}
