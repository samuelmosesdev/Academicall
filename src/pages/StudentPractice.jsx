import { useMemo, useState, useCallback } from "react";
import {
  ClipboardCheck,
  Search,
  Filter,
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCbtData } from "../hooks/useCbtData";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { FREE_LIMITS, isPro } from "../lib/subscription";
import { usersApi } from "../lib/api";

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate", "General"];
const DIFFICULTIES = ["all", "easy", "medium", "hard"];

const fieldClass =
  "rounded-lg border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

export default function StudentPractice() {
  const { user, profile, authMode } = useAuth();
  const { practiceSets, questions, loading } = useCbtData({ withQuestions: true });

  // Filters
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState(profile?.faculty || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [level, setLevel] = useState(profile?.level || "");
  const [difficulty, setDifficulty] = useState("all");

  // Practice session state
  const [activeSet, setActiveSet] = useState(null); // the practiceSet object
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> selectedIndex
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const departments = useMemo(() => departmentsFor(faculty), [faculty]);

  const pro = isPro(profile);
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return practiceSets.filter((s) => {
      const matchesSearch =
        !q ||
        s.courseCode.toLowerCase().includes(q) ||
        s.courseTitle.toLowerCase().includes(q) ||
        s.topics.some((t) => t.toLowerCase().includes(q));
      // Free: department only (and faculty if set)
      const freeFaculty = profile?.faculty || faculty;
      const freeDept = profile?.department || department;
      const matchesFaculty = pro
        ? !faculty || s.faculty === faculty
        : !freeFaculty || s.faculty === freeFaculty;
      const matchesDept = pro
        ? !department || s.department === department
        : !freeDept || s.department === freeDept;
      const matchesLevel = !level || s.level === level;
      return matchesSearch && matchesFaculty && matchesDept && matchesLevel;
    });
  }, [practiceSets, search, faculty, department, level, pro, profile?.faculty, profile?.department]);

  const startPractice = useCallback(
    (set) => {
      let pool = questions.filter((q) => q.courseCode === set.courseCode);
      if (difficulty !== "all") {
        pool = pool.filter((q) => q.difficulty === difficulty);
      }
      // Shuffle
      pool = [...pool].sort(() => Math.random() - 0.5);
      // Cap at 40 questions for a reasonable session
      const cap = isPro(profile) ? 40 : FREE_LIMITS.practiceQuestions;
      if (pool.length > cap) pool = pool.slice(0, cap);

      if (pool.length === 0) return;

      setActiveSet(set);
      setSessionQuestions(pool);
      setCurrentIdx(0);
      setAnswers({});
      setSubmitted(false);
      setShowReview(false);
    },
    [questions, difficulty, profile]
  );

  const selectAnswer = (questionId, optionIndex) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const score = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    for (const q of sessionQuestions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    return { correct, total: sessionQuestions.length, pct: Math.round((correct / sessionQuestions.length) * 100) };
  }, [submitted, sessionQuestions, answers]);

  const finishPractice = async () => {
    setSubmitted(true);
    setShowReview(true);

    // Update student stats (best-effort)
    if (user) {
      try {
        if (authMode === "api") {
          await usersApi.updateMe({
            questionsPracticedCount: (Number(profile?.questionsPracticedCount) || 0) + sessionQuestions.length,
            lastPracticeAt: new Date().toISOString(),
          });
        } else {
          await updateDoc(doc(db, "users", user.uid), {
            questionsPracticedCount: increment(sessionQuestions.length),
            lastPracticeAt: serverTimestamp(),
          });
        }
      } catch {
        // non-critical
      }
    }
  };

  const exitSession = () => {
    setActiveSet(null);
    setSessionQuestions([]);
    setCurrentIdx(0);
    setAnswers({});
    setSubmitted(false);
    setShowReview(false);
  };

  // ─── Active practice session UI ───────────────────────────────────────────
  if (activeSet && sessionQuestions.length > 0) {
    const q = sessionQuestions[currentIdx];
    const selected = answers[q.id];
    const isCorrect = submitted && selected === q.correctIndex;
    const isWrong = submitted && selected !== undefined && selected !== q.correctIndex;

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={exitSession}
              className="mb-1 flex items-center gap-1 text-sm text-ink-muted hover:text-teal"
            >
              <ChevronLeft size={16} /> Exit practice
            </button>
            <h1 className="text-lg font-semibold text-ink">
              {activeSet.courseCode} — {activeSet.courseTitle}
            </h1>
            <p className="text-sm text-ink-muted">
              Question {currentIdx + 1} of {sessionQuestions.length}
              {q.topic && ` · ${q.topic}`}
              {q.difficulty && (
                <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-medium capitalize text-teal">
                  {q.difficulty}
                </span>
              )}
            </p>
          </div>
          {submitted && score && (
            <div className="rounded-xl bg-teal-soft px-4 py-2 text-center">
              <div className="text-xl font-bold text-teal">{score.pct}%</div>
              <div className="text-xs text-ink-muted">
                {score.correct}/{score.total} correct
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 overflow-hidden rounded-full bg-border-light">
          <div
            className="h-full rounded-full bg-teal transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / sessionQuestions.length) * 100}%` }}
          />
        </div>

        {/* Question card */}
        <div className="rounded-2xl border border-border-light bg-card-light p-6 shadow-sm">
          <p className="mb-6 text-base font-medium leading-relaxed text-ink">{q.questionText}</p>

          <div className="space-y-3">
            {(q.options || []).map((opt, idx) => {
              let optionStyle =
                "border-border-light bg-surface-light text-ink hover:border-teal/40";
              if (selected === idx && !submitted) {
                optionStyle = "border-teal bg-teal-soft text-teal font-medium";
              }
              if (submitted) {
                if (idx === q.correctIndex) {
                  optionStyle = "border-teal bg-teal-soft text-teal font-medium";
                } else if (selected === idx) {
                  optionStyle = "border-red-300 bg-red-50 text-red-700";
                } else {
                  optionStyle = "border-border-light bg-surface-light text-ink-muted opacity-60";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={submitted}
                  onClick={() => selectAnswer(q.id, idx)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${optionStyle}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {submitted && idx === q.correctIndex && (
                    <CheckCircle2 size={18} className="shrink-0 text-teal" />
                  )}
                  {submitted && selected === idx && idx !== q.correctIndex && (
                    <XCircle size={18} className="shrink-0 text-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          {submitted && q.explanation && (
            <div className="mt-5 rounded-xl border border-teal/20 bg-teal-soft/50 p-4 text-sm text-ink">
              <span className="font-semibold text-teal">Explanation: </span>
              {q.explanation}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 rounded-lg border border-border-light bg-card-light px-4 py-2 text-sm text-ink disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <div className="flex flex-wrap gap-2">
            {!submitted && currentIdx === sessionQuestions.length - 1 && (
              <button
                type="button"
                onClick={finishPractice}
                className="flex items-center gap-2 rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
              >
                <CheckCircle2 size={16} /> Submit &amp; See Score
              </button>
            )}
            {submitted && (
              <button
                type="button"
                onClick={exitSession}
                className="flex items-center gap-2 rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
              >
                <RotateCcw size={16} /> Back to practice list
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={currentIdx >= sessionQuestions.length - 1}
            onClick={() => setCurrentIdx((i) => Math.min(sessionQuestions.length - 1, i + 1))}
            className="flex items-center gap-1 rounded-lg border border-border-light bg-card-light px-4 py-2 text-sm text-ink disabled:opacity-40"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Mini question navigator */}
        {showReview && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {sessionQuestions.map((sq, i) => {
              const ans = answers[sq.id];
              const correct = ans === sq.correctIndex;
              return (
                <button
                  key={sq.id}
                  type="button"
                  onClick={() => setCurrentIdx(i)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${
                    i === currentIdx
                      ? "ring-2 ring-teal ring-offset-1"
                      : ""
                  } ${
                    ans === undefined
                      ? "bg-border-light text-ink-muted"
                      : correct
                        ? "bg-teal text-white"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Practice list UI ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Practice / CBT</h1>
        <p className="text-sm text-ink-muted">
          Organised by course code, faculty, department and level. Pick a set and start practising.
        </p>
      </div>

      {!isPro(profile) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/25 bg-gradient-to-r from-teal-soft to-white p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Free plan · max {FREE_LIMITS.practiceQuestions} questions per set</p>
            <p className="text-xs text-ink-muted">Timed quizzes and full banks unlock with Pro.</p>
          </div>
          <Link
            to="/dashboard/upgrade"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
          >
            <Crown size={13} /> Go Pro
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-border-light bg-card-light p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <Filter size={15} className="text-teal" />
          Filters
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-light px-3 py-2">
              <Search size={15} className="text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Course code or title…"
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>
          </div>

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

          <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldClass}>
            <option value="">All levels</option>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className={fieldClass}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d === "all" ? "All difficulties" : d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="rounded-2xl border border-dashed border-border-light bg-card-light p-10 text-center text-sm text-ink-muted">
          Loading practice sets…
        </div>
      )}

      {!loading && filteredSets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-light bg-card-light p-10 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-ink-muted" />
          <p className="text-sm font-medium text-ink">No practice sets match your filters</p>
          <p className="mt-1 text-sm text-ink-muted">
            Try clearing filters, or ask an admin to add questions with proper course codes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredSets.map((set) => (
          <div
            key={set.courseCode}
            className="flex flex-col rounded-2xl border border-border-light bg-card-light p-5 shadow-sm transition hover:border-teal/40"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <span className="inline-block rounded-md bg-teal-soft px-2 py-0.5 text-xs font-bold tracking-wide text-teal">
                  {set.courseCode}
                </span>
                <h3 className="mt-1.5 text-sm font-semibold text-ink">{set.courseTitle}</h3>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-soft text-teal">
                <BookOpen size={16} />
              </span>
            </div>

            <div className="mb-4 space-y-1 text-xs text-ink-muted">
              {set.faculty && <div>{set.faculty}</div>}
              {set.department && <div>{set.department}</div>}
              {set.level && <div>{set.level}</div>}
              <div className="flex items-center gap-1.5 pt-1">
                <Layers size={12} />
                {set.questionCount} question{set.questionCount !== 1 ? "s" : ""}
                {set.topics.length > 0 && (
                  <span className="text-ink-muted"> · {set.topics.length} topic{set.topics.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            {set.topics.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1">
                {set.topics.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border-light bg-surface-light px-2 py-0.5 text-[11px] text-ink-muted"
                  >
                    {t}
                  </span>
                ))}
                {set.topics.length > 4 && (
                  <span className="rounded-full border border-border-light bg-surface-light px-2 py-0.5 text-[11px] text-ink-muted">
                    +{set.topics.length - 4}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => startPractice(set)}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
            >
              <Play size={15} /> Start Practice
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
