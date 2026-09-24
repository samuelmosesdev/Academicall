import { useMemo, useState } from "react";
import {
  FileText,
  Search,
  BookOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStudentDocuments } from "../hooks/useStudentDocuments";
import { useCbtData } from "../hooks/useCbtData";
import { FACULTIES } from "../data/facultyData";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";
import { Link } from "react-router-dom";
import { FREE_LIMITS, isPro } from "../lib/subscription";
import StudentGenerateQuizModal from "../components/StudentGenerateQuizModal";

export default function StudentDocuments() {
  const { profile } = useAuth();
  const { documents, loading } = useStudentDocuments();
  const { courses } = useCbtData();
  const { departmentsFor } = useAcademicCatalog();

  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [faculty, setFaculty] = useState(profile?.faculty || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [courseCode, setCourseCode] = useState("");
  const [level, setLevel] = useState(profile?.level || "");
  const [quizMaterial, setQuizMaterial] = useState(null);

  const departments = useMemo(() => departmentsFor(faculty), [faculty]);

  const courseOptions = useMemo(() => {
    let list = courses;
    if (faculty) list = list.filter((c) => c.faculty === faculty);
    if (department) list = list.filter((c) => c.department === department);
    if (level) list = list.filter((c) => !c.level || c.level === level);
    return [...list].sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""))
    );
  }, [courses, faculty, department, level]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return documents
      .filter((d) =>
        [d.title, d.courseCode, d.courseTitle]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [documents, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      const matchesSearch =
        !q ||
        [d.title, d.courseCode, d.courseTitle]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q));
      const matchesFaculty = !faculty || !d.faculty || d.faculty === faculty;
      const matchesDepartment =
        !department || !d.department || d.department === department;
      const matchesLevel = !level || !d.level || d.level === level;
      const matchesCourse = !courseCode || d.courseCode === courseCode;
      return (
        matchesSearch &&
        matchesFaculty &&
        matchesDepartment &&
        matchesLevel &&
        matchesCourse
      );
    });
  }, [documents, search, faculty, department, level, courseCode]);

  const pro = isPro(profile);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const d of filtered) {
      const key = d.courseCode || "GENERAL";
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
    let groups = Array.from(map.values()).sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode)
    );
    if (!pro) {
      groups = groups.map((g) => ({
        ...g,
        lockedCount: Math.max(
          0,
          g.items.length - FREE_LIMITS.documentsPerCourse
        ),
        items: g.items.slice(0, FREE_LIMITS.documentsPerCourse),
      }));
    }
    return groups;
  }, [filtered, pro]);

  const fieldClass =
    "rounded-lg border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Reading Hub</h1>
        <p className="text-sm text-ink-muted">
          Materials grouped by course. Read in app or generate a quiz from a
          material.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border-light bg-card-light px-3 py-2">
            <Search size={15} className="text-ink-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search by title or course…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border-light bg-card-light shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => {
                    setSearch(s.title);
                    setShowSuggestions(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-light"
                >
                  <FileText size={14} className="text-ink-muted" />
                  <span className="truncate">
                    {s.courseCode ? `${s.courseCode} · ` : ""}
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setDepartment("");
              setCourseCode("");
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
            onChange={(e) => {
              setDepartment(e.target.value);
              setCourseCode("");
            }}
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

          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setCourseCode("");
            }}
            className={fieldClass}
          >
            <option value="">All levels</option>
            {[
              "100 Level",
              "200 Level",
              "300 Level",
              "400 Level",
              "500 Level",
              "Postgraduate",
              "General",
            ].map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>

          <select
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            className={fieldClass}
          >
            <option value="">All courses</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-ink-muted">Loading…</div>
      )}

      {!loading && grouped.length === 0 && (
        <div className="rounded-xl border border-border-light bg-card-light px-4 py-10 text-center text-sm text-ink-muted">
          <BookOpen size={28} className="mx-auto mb-2 opacity-50" />
          No materials match your filters. Try clearing a filter or check back
          later.
        </div>
      )}

      <div className="space-y-4">
        {grouped.map((group) => (
          <div
            key={group.courseCode}
            className="overflow-hidden rounded-xl border border-border-light bg-card-light"
          >
            <Link
              to={`/dashboard/reading-hub/${encodeURIComponent(group.courseCode)}`}
              className="block border-b border-border-light bg-surface-light px-4 py-3 transition-colors hover:bg-teal/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[11px] font-bold text-teal">
                    {group.courseCode}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {group.courseTitle}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {group.items.length} material
                    {group.items.length !== 1 ? "s" : ""}
                    {group.lockedCount > 0
                      ? ` · ${group.lockedCount} locked on Free`
                      : ""}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal">
                  Open course <ChevronRight size={14} />
                </span>
              </div>
              {(group.faculty || group.department || group.level) && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  {[group.faculty, group.department, group.level]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </Link>
            <div className="divide-y divide-border-light">
              {group.items.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {d.title}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {d.fileSize
                          ? `${(d.fileSize / 1024 / 1024).toFixed(1)} MB`
                          : "PDF"}
                        {d.id ? ` · ID: ${String(d.id).slice(0, 8)}…` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Link
                      to={`/dashboard/reading-hub/doc/${d.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-dark"
                    >
                      Read in app
                    </Link>
                    <button
                      type="button"
                      onClick={() => setQuizMaterial(d)}
                      className="flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/20"
                    >
                      <Sparkles size={13} /> Generate Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <StudentGenerateQuizModal
        open={!!quizMaterial}
        onClose={() => setQuizMaterial(null)}
        material={quizMaterial}
      />
    </div>
  );
}