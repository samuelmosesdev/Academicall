import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ClipboardCheck,
  Search,
  Filter,
  Play,
  Timer,
  BookOpen,
  Layers,
  Crown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCbtData } from "../hooks/useCbtData";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { Link, useSearchParams } from "react-router-dom";
import { FREE_LIMITS, isPro } from "../lib/subscription";
import { usersApi, quizzesApi } from "../lib/api";
import CbtExamWorkspace from "../components/cbt/CbtExamWorkspace";


const LEVELS = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
  "General",
];
const DIFFICULTIES = ["all", "easy", "medium", "hard"];

const fieldClass =
  "rounded-lg border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

export default function StudentPractice() {
  const { user, profile, authMode, refreshProfile } = useAuth();
  const { practiceSets, questions, loading } = useCbtData({ withQuestions: true });

  // Filters
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState(profile?.faculty || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [level, setLevel] = useState(profile?.level || "");
  const [difficulty, setDifficulty] = useState("all");

  // Session state
  const [activeSet, setActiveSet] = useState(null);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [myQuizzes, setMyQuizzes] = useState([]);
  const [myLoading, setMyLoading] = useState(true);
  const [activeQuizId, setActiveQuizId] = useState(null);

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
  }, [
    practiceSets,
    search,
    faculty,
    department,
    level,
    pro,
    profile?.faculty,
    profile?.department,
  ]);

  const startPractice = useCallback(
    (set, { timed = false } = {}) => {
      let pool = questions.filter((q) => q.courseCode === set.courseCode);
      if (difficulty !== "all") {
        pool = pool.filter((q) => q.difficulty === difficulty);
      }
      pool = [...pool].sort(() => Math.random() - 0.5);
      const cap = isPro(profile) ? 50 : FREE_LIMITS.practiceQuestions;
      if (pool.length > cap) pool = pool.slice(0, cap);
      if (pool.length === 0) return;

      setActiveQuizId(null);
      setActiveSet(set);
      setSessionQuestions(pool);
      setCurrentIdx(0);
      setAnswers({});
      setFlagged(new Set());
      setSubmitted(false);

      if (timed) {
        const secs = Math.min(
          90 * 60,
          Math.max(10 * 60, Math.round(pool.length * 72))
        );
        setTimeLeft(secs);
      } else {
        setTimeLeft(null);
      }
    },
    [questions, difficulty, profile]
  );

  const selectAnswer = (questionId, optionIndex) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const clearAnswer = (questionId) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const toggleFlag = (questionId) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const score = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    for (const q of sessionQuestions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    return {
      correct,
      total: sessionQuestions.length,
      pct: Math.round((correct / sessionQuestions.length) * 100) || 0,
    };
  }, [submitted, sessionQuestions, answers]);

  const finishPractice = useCallback(async () => {
    setSubmitted(true);
    setTimeLeft(null);

    if (activeQuizId || activeSet?.quizId) {
      const id = activeQuizId || activeSet.quizId;
      try {
        let correct = 0;
        for (const q of sessionQuestions) {
          if (answers[q.id] === q.correctIndex) correct += 1;
        }
        const pct =
          sessionQuestions.length > 0
            ? Math.round((correct / sessionQuestions.length) * 100)
            : 0;
        await quizzesApi.update(id, {
          status: "completed",
          score: pct,
          completedAt: new Date().toISOString(),
        });
      } catch {
        // non-critical
      }
    }

    if (user) {
      try {
        if (authMode === "api") {
          await usersApi.updateMe({
            questionsPracticedCount:
              (Number(profile?.questionsPracticedCount) || 0) +
              sessionQuestions.length,
            lastPracticeAt: new Date().toISOString(),
          });
          await refreshProfile();
          window.dispatchEvent(new Event("student-activity-updated"));
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
  }, [
    user,
    authMode,
    profile?.questionsPracticedCount,
    sessionQuestions,
    answers,
    refreshProfile,
    activeQuizId,
    activeSet,
  ]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft == null || submitted || timeLeft > 0) return;
    finishPractice();
  }, [timeLeft, submitted, finishPractice]);

  // Countdown
  useEffect(() => {
    if (timeLeft == null || submitted || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, submitted]);

  const exitSession = () => {
    setActiveSet(null);
    setSessionQuestions([]);
    setCurrentIdx(0);
    setAnswers({});
    setFlagged(new Set());
    setSubmitted(false);
    setTimeLeft(null);
    setActiveQuizId(null);
  };

  useEffect(() => {
    let alive = true;
    setMyLoading(true);
    quizzesApi
      .listMine()
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res?.quizzes)
          ? res.quizzes
          : Array.isArray(res)
            ? res
            : [];
        setMyQuizzes(list);
      })
      .catch(() => {
        if (alive) setMyQuizzes([]);
      })
      .finally(() => {
        if (alive) setMyLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [submitted]);

  async function openMyQuiz(quiz, { reset = false } = {}) {
    let qs = quiz.questions;
    if (!qs?.length && quiz.questionIds?.length) {
      qs = quiz.questionIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean);
    }
    if (!qs?.length) {
      try {
        const full = await quizzesApi.get(quiz.id);
        qs = full.questions || full.quiz?.questions || [];
      } catch {
        return;
      }
    }
    if (!qs?.length) return;

    setActiveQuizId(quiz.id);
    setActiveSet({
      courseCode: quiz.courseCode || "QUIZ",
      courseTitle: quiz.materialTitle || quiz.courseTitle || "Generated quiz",
      quizId: quiz.id,
    });
    setSessionQuestions(qs);
    setCurrentIdx(0);
    setAnswers(reset ? {} : quiz.answers || {});
    setFlagged(new Set());
    setSubmitted(false);
    setTimeLeft(null);
  }

  useEffect(() => {
    const qid = searchParams.get("quiz");
    if (!qid || !myQuizzes.length) return;
    if (activeQuizId === qid) return;
    const quiz = myQuizzes.find((q) => q.id === qid);
    if (!quiz) return;
    openMyQuiz(quiz);
    const next = new URLSearchParams(searchParams);
    next.delete("quiz");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myQuizzes]);

  // ─── Active exam workspace ───────────────────────────────────────────────
  if (activeSet && sessionQuestions.length > 0) {
    return (
      <CbtExamWorkspace
        set={activeSet}
        questions={sessionQuestions}
        answers={answers}
        flagged={flagged}
        currentIdx={currentIdx}
        timeLeft={timeLeft}
        submitted={submitted}
        score={score}
        profile={profile}
        onSelectAnswer={selectAnswer}
        onToggleFlag={toggleFlag}
        onNavigate={setCurrentIdx}
        onSubmit={finishPractice}
        onExit={exitSession}
        onClearAnswer={clearAnswer}
      />
    );
  }

  // ─── Practice list ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Practice / CBT</h1>
        <p className="text-sm text-ink-muted">
          Organised by course code, faculty, department and level. Pick a set and
          start practising or run a timed CBT.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">My generated quizzes</h2>
        {myLoading && <p className="text-sm text-ink-muted">Loading…</p>}
        {!myLoading && myQuizzes.length === 0 && (
          <p className="rounded-xl border border-dashed border-border-light bg-card-light px-4 py-6 text-center text-sm text-ink-muted">
            Quizzes you generate from Reading Hub materials appear here. You can
            retake them anytime.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="rounded-xl border border-border-light bg-card-light p-4"
            >
              <div className="text-xs font-bold text-teal">
                {quiz.courseCode || "QUIZ"}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-semibold text-ink">
                {quiz.materialTitle || quiz.courseTitle || "Generated quiz"}
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {quiz.questionCount || quiz.questionIds?.length || "—"} Qs
                {quiz.difficulty ? ` · ${quiz.difficulty}` : ""}
                {quiz.score != null ? ` · Last ${quiz.score}%` : ""}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openMyQuiz(quiz)}
                  className="flex-1 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => openMyQuiz(quiz, { reset: true })}
                  className="rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink hover:bg-surface-light"
                >
                  Reset & redo
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!pro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/25 bg-gradient-to-r from-teal-soft to-white p-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              Free plan · max {FREE_LIMITS.practiceQuestions} questions per set
            </p>
            <p className="text-xs text-ink-muted">
              Timed quizzes and full banks unlock with Pro.
            </p>
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

          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={fieldClass}
          >
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
                {d === "all"
                  ? "All difficulties"
                  : d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-dashed border-border-light bg-card-light p-10 text-center text-sm text-ink-muted">
          Loading practice sets…
        </div>
      )}

      {!loading && filteredSets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-light bg-card-light p-10 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-ink-muted" />
          <p className="text-sm font-medium text-ink">
            No practice sets match your filters
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Try clearing filters, or ask an admin to add questions with proper
            course codes.
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
                <h3 className="mt-1.5 text-sm font-semibold text-ink">
                  {set.courseTitle}
                </h3>
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
                {set.questionCount} question
                {set.questionCount !== 1 ? "s" : ""}
                {set.topics.length > 0 && (
                  <span>
                    {" "}
                    · {set.topics.length} topic
                    {set.topics.length !== 1 ? "s" : ""}
                  </span>
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

            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={() => startPractice(set)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
              >
                <Play size={15} /> Practice
              </button>
              <button
                type="button"
                onClick={() => startPractice(set, { timed: true })}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-teal/40 bg-teal-soft px-3 py-2.5 text-sm font-semibold text-teal hover:bg-teal/15"
              >
                <Timer size={15} /> Timed CBT
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}