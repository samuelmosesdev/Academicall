import { useMemo, useState, useCallback, useEffect } from "react";
import { ArrowRight, ClipboardCheck, Crown, Search, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCbtData } from "../hooks/useCbtData";
import { FACULTIES } from "../data/facultyData";
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { Link, useSearchParams } from "react-router-dom";
import { FREE_LIMITS, isPro } from "../lib/subscription";
import { usersApi, quizzesApi } from "../lib/api";
import CbtExamWorkspace, { formatDuration } from "../components/cbt/CbtExamWorkspace";
import { loadHistory, recordAttempt, courseProgress, syncHistory } from "../components/cbt/attempts";
import { getAcademicScope, matchesAcademicProgram } from "../lib/academicScope";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";
import { PageHeader } from "../components/ui";

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate", "General"];
const DIFFICULTIES = ["all", "easy", "medium", "hard"];
const COUNT_STEPS = [10, 20, 30, 40, 50];
const MINUTE_STEPS = [10, 15, 20, 30, 45, 60, 90];

/** The old automatic exam time: 72 seconds a question, between 10 and 90 minutes. */
const autoSeconds = (n) => Math.min(90 * 60, Math.max(10 * 60, Math.round(n * 72)));
const suggestedMinutes = (n) => {
  const m = autoSeconds(n) / 60;
  return MINUTE_STEPS.reduce((best, s) => (Math.abs(s - m) < Math.abs(best - m) ? s : best), MINUTE_STEPS[0]);
};

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function whenLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days < 1 && new Date().toDateString() === d.toDateString()) return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (days < 2) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function StudentPractice() {
  const { user, profile, authMode, refreshProfile } = useAuth();
  const { practiceSets, questions, loading } = useCbtData({ withQuestions: true });
  const { programsForFaculty } = useAcademicCatalog(profile?.institutionId);
  const userKey = user?.id || user?.uid || profile?.id;

  // Filters
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState(profile?.faculty || "");
  const [department, setDepartment] = useState(() => getAcademicScope(profile));
  const [level, setLevel] = useState(profile?.level || "");
  const [difficulty, setDifficulty] = useState("all");

  // Setup
  const [selectedCode, setSelectedCode] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState("practice");
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(null); // null = follow the suggestion

  // Session state
  const [activeSet, setActiveSet] = useState(null);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [totalTime, setTotalTime] = useState(null);
  const [sessionMode, setSessionMode] = useState("practice");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(null);
  const [lastConfig, setLastConfig] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [myQuizzes, setMyQuizzes] = useState([]);
  const [myLoading, setMyLoading] = useState(true);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [history, setHistory] = useState(() => loadHistory(userKey));

  useEffect(() => {
    let alive = true;
    setHistory(loadHistory(userKey));
    syncHistory(userKey).then((next) => alive && setHistory(next));
    const onOnline = () => syncHistory(userKey).then((next) => alive && setHistory(next));
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, [userKey]);

  const departments = useMemo(() => programsForFaculty(faculty), [faculty, programsForFaculty]);
  const pro = isPro(profile);
  const cap = pro ? 50 : FREE_LIMITS.practiceQuestions;

  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return practiceSets.filter((s) => {
      const matchesSearch =
        !q ||
        s.courseCode.toLowerCase().includes(q) ||
        s.courseTitle.toLowerCase().includes(q) ||
        s.topics.some((t) => t.toLowerCase().includes(q));
      const freeFaculty = profile?.faculty || faculty;
      const freeProgram = getAcademicScope(profile) || department;
      const matchesFaculty = pro ? !faculty || s.faculty === faculty : !freeFaculty || s.faculty === freeFaculty;
      const selectedProgram = pro ? department : freeProgram;
      const matchesProgram = !selectedProgram || matchesAcademicProgram(s.program || s.department, selectedProgram);
      const matchesLevel = !level || s.level === level;
      return matchesSearch && matchesFaculty && matchesProgram && matchesLevel;
    });
  }, [practiceSets, search, faculty, department, level, pro, profile]);

  /** Question ids per course, to measure how much of each bank has been seen. */
  const bankIds = useMemo(() => {
    const map = new Map();
    questions.forEach((q) => {
      const key = q.courseCode || "GENERAL";
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(q.id);
    });
    return map;
  }, [questions]);

  const selectedSet = useMemo(() => practiceSets.find((s) => s.courseCode === selectedCode) || null, [practiceSets, selectedCode]);
  const poolSize = useMemo(() => {
    if (!selectedSet) return 0;
    return questions.filter((q) => q.courseCode === selectedSet.courseCode && (difficulty === "all" || q.difficulty === difficulty)).length;
  }, [questions, selectedSet, difficulty]);
  const maxCount = Math.min(poolSize, cap);
  const effectiveCount = Math.max(1, Math.min(count, maxCount || 1));
  const effectiveMinutes = minutes ?? suggestedMinutes(effectiveCount);

  const startPractice = useCallback(
    (set, { timed = false, count: wanted, minutes: mins, difficulty: diff } = {}) => {
      const diffLevel = diff ?? difficulty;
      let pool = questions.filter((q) => q.courseCode === set.courseCode);
      if (diffLevel !== "all") pool = pool.filter((q) => q.difficulty === diffLevel);
      pool = shuffle(pool);
      const limit = Math.min(isPro(profile) ? 50 : FREE_LIMITS.practiceQuestions, wanted || Infinity);
      if (pool.length > limit) pool = pool.slice(0, limit);
      if (pool.length === 0) return;

      setActiveQuizId(null);
      setActiveSet(set);
      setSessionQuestions(pool);
      setCurrentIdx(0);
      setAnswers({});
      setFlagged(new Set());
      setSubmitted(false);
      setSessionMode(timed ? "exam" : "practice");
      setStartedAt(Date.now());
      setElapsedSec(null);
      setLastConfig({ timed, count: wanted, minutes: mins, difficulty: diffLevel });
      setSheetOpen(false);

      if (timed) {
        const secs = mins ? mins * 60 : autoSeconds(pool.length);
        setTimeLeft(secs);
        setTotalTime(secs);
      } else {
        setTimeLeft(null);
        setTotalTime(null);
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

    let correct = 0;
    for (const q of sessionQuestions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    const pct = sessionQuestions.length > 0 ? Math.round((correct / sessionQuestions.length) * 100) : 0;
    const took = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
    setElapsedSec(took);

    const quizId = activeQuizId || activeSet?.quizId;
    setHistory(recordAttempt(
      userKey,
      {
        courseCode: activeSet?.courseCode,
        courseTitle: activeSet?.courseTitle,
        mode: sessionMode,
        quiz: Boolean(quizId),
        correct,
        total: sessionQuestions.length,
        pct,
        durationSec: took,
      },
      quizId ? [] : sessionQuestions.map((q) => q.id),
      (nextHistory) => setHistory(nextHistory)
    ));

    if (quizId) {
      try {
        await quizzesApi.update(quizId, {
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
            questionsPracticedCount: (Number(profile?.questionsPracticedCount) || 0) + sessionQuestions.length,
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
  }, [user, userKey, authMode, profile?.questionsPracticedCount, sessionQuestions, answers, refreshProfile, activeQuizId, activeSet, sessionMode, startedAt]);

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
    setTotalTime(null);
    setActiveQuizId(null);
  };

  useEffect(() => {
    let alive = true;
    setMyLoading(true);
    quizzesApi
      .listMine()
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res?.quizzes) ? res.quizzes : Array.isArray(res) ? res : [];
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
      qs = quiz.questionIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
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
    setTotalTime(null);
    setSessionMode("practice");
    setStartedAt(Date.now());
    setElapsedSec(null);
    setLastConfig(null);
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

  function retake() {
    if (activeQuizId || activeSet?.quizId) {
      const quiz = myQuizzes.find((x) => x.id === (activeQuizId || activeSet.quizId));
      if (quiz) openMyQuiz(quiz, { reset: true });
      else {
        // Same questions, fresh answers
        setSessionQuestions((qs) => shuffle(qs));
        setAnswers({}); setFlagged(new Set()); setSubmitted(false); setCurrentIdx(0); setStartedAt(Date.now()); setElapsedSec(null);
      }
      return;
    }
    if (activeSet) startPractice(activeSet, lastConfig || {});
  }

  function pickCourse(code) {
    setSelectedCode(code);
    setSheetOpen(true);
    setMinutes(null);
  }

  function start() {
    if (!selectedSet || !maxCount) return;
    startPractice(selectedSet, { timed: mode === "exam", count: effectiveCount, minutes: mode === "exam" ? effectiveMinutes : null, difficulty });
  }

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
        totalTime={totalTime}
        elapsedSec={elapsedSec}
        submitted={submitted}
        score={score}
        profile={profile}
        mode={sessionMode}
        onSelectAnswer={selectAnswer}
        onToggleFlag={toggleFlag}
        onNavigate={setCurrentIdx}
        onSubmit={finishPractice}
        onExit={exitSession}
        onClearAnswer={clearAnswer}
        onRetake={retake}
      />
    );
  }

  // ─── Landing ────────────────────────────────────────────────────────────
  const recent = history.attempts.slice(0, 6);
  const lastTen = history.attempts.slice(0, 10);
  const average = lastTen.length ? Math.round(lastTen.reduce((s, a) => s + (a.pct || 0), 0) / lastTen.length) : null;
  const practised = Number(profile?.questionsPracticedCount) || 0;
  const filtersOn = Boolean(search || (pro && faculty) || level);

  const setup = selectedSet && (
    <SetupPanel
      set={selectedSet}
      progress={courseProgress(history, selectedSet.courseCode, bankIds.get(selectedSet.courseCode))}
      mode={mode}
      setMode={setMode}
      count={effectiveCount}
      setCount={(n) => { setCount(n); }}
      maxCount={maxCount}
      poolSize={poolSize}
      cap={cap}
      pro={pro}
      minutes={effectiveMinutes}
      setMinutes={setMinutes}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      onStart={start}
      onClose={() => { setSheetOpen(false); setSelectedCode(null); }}
    />
  );

  return (
    <div className="space-y-7">
      <PageHeader
        title="Practice CBT"
        description="Pick a course, choose how you want to sit it, and go. Practice to learn as you answer, or take a timed exam to see where you stand."
      />

      {/* Your numbers */}
      <section className="grid grid-cols-3 divide-x divide-border-subtle rounded-[1.3rem] border border-border-subtle bg-bg-panel">
        <Figure label="Questions practised" value={practised.toLocaleString()} />
        <Figure label="Sessions on this device" value={history.attempts.length} />
        <Figure label="Average, last 10" value={average != null ? `${average}%` : "—"} />
      </section>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_21rem] [&>*]:min-w-0">
        {/* Courses */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-[1.45rem] font-[420] leading-tight tracking-[-0.02em] text-text-primary">Choose a course</h2>
              <p className="mt-0.5 text-sm text-text-muted">{loading ? "Loading the question banks…" : `${filteredSets.length} course${filteredSets.length === 1 ? "" : "s"} with questions`}</p>
            </div>
            {filtersOn && (
              <button type="button" onClick={() => { setSearch(""); if (pro) { setFaculty(""); setDepartment(""); } setLevel(""); }} className="text-xs font-medium text-text-muted hover:text-text-primary">Clear filters</button>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] [&>*]:min-w-0 [&>*]:w-full">
            <label className="relative sm:col-span-2 xl:col-span-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Course code, title or topic" className="acx-input pl-9" aria-label="Search courses" />
            </label>
            <select value={faculty} onChange={(e) => { setFaculty(e.target.value); setDepartment(""); }} className="acx-input" aria-label="Faculty">
              <option value="">All faculties</option>
              {FACULTIES.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="acx-input" disabled={!faculty} aria-label="Programme">
              <option value="">All programmes</option>
              {departments.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="acx-input" aria-label="Level">
              <option value="">All levels</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {loading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {[0, 1, 2, 3].map((k) => <div key={k} className="h-44 animate-pulse rounded-[1.3rem] bg-bg-elevated" />)}
            </div>
          )}

          {!loading && filteredSets.length === 0 && (
            <div className="rounded-[1.3rem] border border-dashed border-border-strong px-6 py-12 text-center">
              <ClipboardCheck size={28} className="mx-auto text-text-muted" />
              <p className="mt-3 font-medium text-text-primary">No courses match</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">Try clearing the filters. If your course is missing, its questions haven't been added yet.</p>
            </div>
          )}

          {!loading && filteredSets.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              {filteredSets.map((set) => (
                <CourseCard
                  key={set.courseCode}
                  set={set}
                  progress={courseProgress(history, set.courseCode, bankIds.get(set.courseCode))}
                  selected={selectedCode === set.courseCode}
                  onPick={() => pickCourse(set.courseCode)}
                />
              ))}
            </div>
          )}

          {!pro && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] border border-border-subtle bg-bg-panel-alt px-4 py-3.5">
              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">Free plan:</span> up to {FREE_LIMITS.practiceQuestions} questions a session. Pro opens up to 50 and the full banks.
              </p>
              <Link to="/dashboard/upgrade" className="acx-btn-ghost"><Crown size={13} /> See Pro</Link>
            </div>
          )}
        </section>

        {/* Setup + history */}
        <aside className="space-y-5">
          <div className="hidden lg:block lg:sticky lg:top-24">
            {setup || (
              <div className="rounded-[1.3rem] border border-dashed border-border-strong px-5 py-8 text-center">
                <p className="font-display text-[1.15rem] font-[420] text-text-primary">Set up a session</p>
                <p className="mt-1.5 text-sm text-text-muted">Choose a course on the left. You'll pick practice or a timed exam, how many questions, and how long.</p>
              </div>
            )}
          </div>

          <section className="rounded-[1.3rem] border border-border-subtle bg-bg-panel p-4">
            <h3 className="text-sm font-semibold text-text-primary">Recent sessions</h3>
            {recent.length === 0 ? (
              <p className="mt-1.5 text-sm text-text-muted">Your scores will appear here after your first session.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border-subtle">
                {recent.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex items-center gap-3 py-2.5">
                    <ScoreBadge pct={a.pct} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{a.courseCode}{a.courseTitle && a.courseTitle !== a.courseCode ? <span className="font-normal text-text-muted"> · {a.courseTitle}</span> : null}</p>
                      <p className="text-xs text-text-muted">{a.mode === "exam" ? "Timed" : "Practice"} · {a.correct}/{a.total}{a.durationSec ? ` · ${formatDuration(a.durationSec)}` : ""} · {whenLabel(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* Generated quizzes */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-[1.45rem] font-[420] leading-tight tracking-[-0.02em] text-text-primary">From your reading</h2>
          <p className="mt-0.5 text-sm text-text-muted">Quizzes you generated from Reading Hub materials. Open one to continue, or start it again from blank.</p>
        </div>
        {myLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {!myLoading && myQuizzes.length === 0 && (
          <p className="rounded-[1.3rem] border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">
            None yet. Open a document in the <Link to="/dashboard/reading-hub" className="font-medium text-accent hover:underline">Reading Hub</Link> and generate a quiz from it.
          </p>
        )}
        {myQuizzes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myQuizzes.map((quiz) => (
              <div key={quiz.id} className="flex flex-col rounded-[1.3rem] border border-border-subtle bg-bg-panel p-4">
                <p className="eyebrow text-text-muted">{quiz.courseCode || "Quiz"}</p>
                <p className="mt-1.5 line-clamp-2 font-medium leading-snug text-text-primary">{quiz.materialTitle || quiz.courseTitle || "Generated quiz"}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {quiz.questionCount || quiz.questionIds?.length || "—"} questions
                  {quiz.difficulty ? ` · ${quiz.difficulty}` : ""}
                  {quiz.score != null ? ` · last ${quiz.score}%` : ""}
                </p>
                <div className="mt-4 flex gap-2 pt-1">
                  <button type="button" onClick={() => openMyQuiz(quiz)} className="acx-btn flex-1 justify-center">Open</button>
                  <button type="button" onClick={() => openMyQuiz(quiz, { reset: true })} className="acx-btn-ghost">Start again</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mobile: set-up sheet */}
      {sheetOpen && setup && (
        <div className="fixed inset-0 z-[65] flex items-end bg-midnight/55 backdrop-blur-[2px] lg:hidden" onClick={() => setSheetOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Set up ${selectedSet.courseCode}`} onClick={(e) => e.stopPropagation()} className="animate-pop max-h-[90vh] w-full overflow-y-auto rounded-t-[1.6rem] bg-bg-panel pb-[env(safe-area-inset-bottom)]">
            {setup}
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }) {
  return (
    <div className="px-3 py-3.5 sm:px-5 sm:py-4">
      <p className="text-[0.7rem] leading-tight text-text-muted sm:text-xs">{label}</p>
      <p className="num mt-1 text-[1.35rem] font-semibold text-text-primary sm:text-[1.6rem]">{value}</p>
    </div>
  );
}

function ScoreBadge({ pct }) {
  const tone = pct >= 70 ? "text-status-success" : pct >= 50 ? "text-text-primary" : "text-status-danger";
  return <span className={`num flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-panel-alt text-sm font-semibold ${tone}`}>{pct}%</span>;
}

function CourseCard({ set, progress, selected, onPick }) {
  const seenPct = set.questionCount ? Math.min(100, Math.round((progress.seen / set.questionCount) * 100)) : 0;
  const meta = [set.level, `${set.questionCount} question${set.questionCount === 1 ? "" : "s"}`, set.topics.length ? `${set.topics.length} topic${set.topics.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`group flex flex-col rounded-[1.3rem] border bg-bg-panel p-4 text-left transition sm:p-5 ${selected ? "border-accent ring-1 ring-accent" : "border-border-subtle hover:border-border-strong"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-accent">{set.courseCode}</p>
        {progress.best != null && <span className="num text-xs text-text-muted">best <span className="font-semibold text-text-primary">{progress.best}%</span></span>}
      </div>
      <p className="mt-1.5 line-clamp-2 font-display text-[1.12rem] font-[440] leading-snug tracking-[-0.01em] text-text-primary">{set.courseTitle}</p>
      <p className="mt-1 text-xs text-text-muted">{meta}</p>

      {set.topics.length > 0 && (
        <p className="mt-3 line-clamp-1 text-xs text-text-secondary">{set.topics.slice(0, 4).join(" · ")}{set.topics.length > 4 ? ` +${set.topics.length - 4}` : ""}</p>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-baseline justify-between text-[0.72rem] text-text-muted">
          <span>{progress.seen ? `${progress.seen} of ${set.questionCount} seen` : "Not started"}</span>
          {progress.sessions > 0 && <span>{progress.sessions} session{progress.sessions === 1 ? "" : "s"}</span>}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${seenPct}%` }} />
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-text-primary group-hover:text-accent">
          Set up <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function Choice({ on, onClick, disabled, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`num rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${on ? "border-midnight bg-midnight text-white dark:border-lemon dark:bg-lemon dark:text-midnight" : "border-border-subtle text-text-secondary hover:border-text-muted"} ${className}`}
    >
      {children}
    </button>
  );
}

function SetupPanel({ set, progress, mode, setMode, count, setCount, maxCount, poolSize, cap, pro, minutes, setMinutes, difficulty, setDifficulty, onStart, onClose }) {
  const counts = [...COUNT_STEPS.filter((n) => n < maxCount), maxCount].filter((n, i, a) => n > 0 && a.indexOf(n) === i);
  const diffs = set.difficulties || {};
  return (
    <div className="rounded-[1.3rem] border border-border-subtle bg-bg-panel p-5 max-lg:rounded-none max-lg:border-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-accent">{set.courseCode}</p>
          <h3 className="mt-1 font-display text-[1.3rem] font-[440] leading-snug tracking-[-0.015em] text-text-primary">{set.courseTitle}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {set.questionCount} in the bank{progress.last != null ? ` · last score ${progress.last}%` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-text-muted hover:bg-bg-hover" aria-label="Close set-up"><X size={17} /></button>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-text-secondary">How you'll sit it</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["practice", "Practice", "Check each answer as you go, with hints. No clock."],
            ["exam", "Timed exam", "Against the clock. Marked when you submit."],
          ].map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-2xl border p-3 text-left transition ${mode === k ? "border-accent bg-accent-soft" : "border-border-subtle hover:border-border-strong"}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${mode === k ? "border-accent" : "border-border-strong"}`}>{mode === k && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</span>
                {t}
              </span>
              <span className="mt-1 block text-[0.74rem] leading-snug text-text-muted">{d}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-text-secondary">Difficulty</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => {
            const n = d === "all" ? set.questionCount : diffs[d] || 0;
            return (
              <Choice key={d} on={difficulty === d} disabled={n === 0} onClick={() => setDifficulty(d)}>
                <span className="capitalize">{d === "all" ? "Any" : d}</span> <span className="opacity-60">{n}</span>
              </Choice>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-text-secondary">Questions</legend>
        {maxCount === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No questions at this difficulty. Pick another.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {counts.map((n) => (
              <Choice key={n} on={count === n} onClick={() => setCount(n)}>{n === maxCount && n === poolSize ? `All ${n}` : n}</Choice>
            ))}
          </div>
        )}
        {!pro && poolSize > cap && <p className="mt-1.5 text-[0.72rem] text-text-muted">Free plan sessions stop at {cap}. <Link to="/dashboard/upgrade" className="font-medium text-accent hover:underline">Pro</Link> goes up to 50.</p>}
      </fieldset>

      {mode === "exam" && (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-text-secondary">Time allowed</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MINUTE_STEPS.map((m) => <Choice key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Choice>)}
          </div>
          <p className="mt-1.5 text-[0.72rem] text-text-muted">About {Math.round((minutes * 60) / Math.max(count, 1))} seconds a question. The paper submits itself when time runs out.</p>
        </fieldset>
      )}

      <button type="button" onClick={onStart} disabled={!maxCount} className="acx-btn mt-6 w-full justify-center !py-3 !text-[0.9rem]">
        {mode === "exam" ? `Start exam · ${count} questions, ${minutes} min` : `Start practice · ${count} questions`}
      </button>
    </div>
  );
}
