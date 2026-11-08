import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Grid3X3,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import CbtSubmitModal from "./CbtSubmitModal";
import ExamTools from "../ExamTools";
import { appConfirm } from "../../lib/dialogs";

export function formatClock(sec) {
  if (sec == null || sec < 0) return "--:--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(sec) {
  if (!sec || sec < 1) return "under a minute";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m}m`;
}

const letterOf = (i) => String.fromCharCode(65 + i);
const isTyping = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * The exam room. Takes the whole screen while a session runs.
 *
 * mode "practice": no clock unless one was set, a hint (H) and "Check answer" per question.
 * mode "exam": the clock runs, nothing is revealed until the paper is submitted.
 * After submitting: a results page, then a review of every question with its explanation.
 */
export default function CbtExamWorkspace({
  set,
  questions,
  answers,
  flagged,
  currentIdx,
  timeLeft,
  totalTime,
  elapsedSec,
  submitted,
  score,
  profile,
  mode = "practice",
  onSelectAnswer,
  onToggleFlag,
  onNavigate,
  onSubmit,
  onExit,
  onClearAnswer,
  onRetake,
}) {
  const practice = mode !== "exam";
  const [showSubmit, setShowSubmit] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [view, setView] = useState("paper"); // paper | results
  const [reviewFilter, setReviewFilter] = useState("all"); // all | wrong | skipped | flagged
  const scroller = useRef(null);
  const wasSubmitted = useRef(submitted);

  const q = questions[currentIdx];
  const selected = q ? answers[q.id] : undefined;
  const isFlagged = q ? flagged.has(q.id) : false;
  const isRevealed = submitted || (q && revealed.has(q.id));
  const lowTime = timeLeft != null && timeLeft <= 300;

  // Focus mode: the page behind does not scroll while the paper is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Leaving mid-paper loses the answers, so the browser asks first.
  useEffect(() => {
    if (submitted) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [submitted]);

  // On submit (by hand or when the clock runs out) open the results first.
  useEffect(() => {
    if (submitted && !wasSubmitted.current) { setView("results"); setShowSubmit(false); }
    if (!submitted && wasSubmitted.current) { setView("paper"); setRevealed(new Set()); setReviewFilter("all"); }
    wasSubmitted.current = submitted;
  }, [submitted]);

  // New question: hint closed, back to the top of the card.
  useEffect(() => {
    setShowHint(false);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIdx]);

  const stats = useMemo(() => {
    let answered = 0;
    let flaggedCount = 0;
    questions.forEach((qq) => {
      if (answers[qq.id] !== undefined) answered += 1;
      if (flagged.has(qq.id)) flaggedCount += 1;
    });
    return {
      answered,
      flagged: flaggedCount,
      unattempted: questions.length - answered,
      progressPct: questions.length ? Math.round((answered / questions.length) * 100) : 0,
    };
  }, [questions, answers, flagged]);

  const statusOf = useCallback((qq) => {
    const a = answers[qq.id];
    if (submitted) return a === undefined ? "skipped" : a === qq.correctIndex ? "correct" : "wrong";
    if (practice && revealed.has(qq.id)) return a === qq.correctIndex ? "correct" : "wrong";
    return a === undefined ? "blank" : "answered";
  }, [answers, submitted, practice, revealed]);

  const choose = useCallback((idx) => {
    if (!q || submitted || (practice && revealed.has(q.id))) return;
    onSelectAnswer(q.id, idx);
  }, [q, submitted, practice, revealed, onSelectAnswer]);

  const check = useCallback(() => {
    if (!q || selected === undefined) return;
    setRevealed((prev) => new Set(prev).add(q.id));
  }, [q, selected]);

  const go = useCallback((i) => {
    if (i < 0 || i >= questions.length) return;
    onNavigate(i);
  }, [questions.length, onNavigate]);

  const goNextInFilter = useCallback((dir) => {
    if (!submitted || reviewFilter === "all") return go(currentIdx + dir);
    for (let i = currentIdx + dir; i >= 0 && i < questions.length; i += dir) {
      const s = statusOf(questions[i]);
      if ((reviewFilter === "wrong" && s === "wrong") || (reviewFilter === "skipped" && s === "skipped") || (reviewFilter === "flagged" && flagged.has(questions[i].id))) return go(i);
    }
    return undefined;
  }, [submitted, reviewFilter, currentIdx, questions, statusOf, flagged, go]);

  async function exit() {
    if (!submitted && stats.answered > 0) {
      const ok = await appConfirm("Leave this session? Your answers so far won't be saved.", { tone: "danger", confirmLabel: "Leave" });
      if (!ok) return;
    }
    onExit();
  }

  // Keyboard: A–D (or 1–4) answer, N/P or arrows move, F flags, H hint, Enter checks in practice.
  useEffect(() => {
    if (view !== "paper" || showSubmit) return undefined;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const optionCount = q?.options?.length || 0;
      let idx = -1;
      if (/^[A-Z]$/.test(key)) idx = key.charCodeAt(0) - 65;
      if (/^[1-9]$/.test(key)) idx = Number(key) - 1;
      if (idx >= 0 && idx < optionCount && !["F", "H", "N", "P"].includes(key)) { e.preventDefault(); choose(idx); return; }
      if (key === "N" || key === "ArrowRight") { e.preventDefault(); goNextInFilter(1); }
      else if (key === "P" || key === "ArrowLeft") { e.preventDefault(); goNextInFilter(-1); }
      else if (key === "F" && !submitted && q) { e.preventDefault(); onToggleFlag(q.id); }
      else if (key === "H" && practice && !submitted && q?.explanation) { e.preventDefault(); setShowHint((v) => !v); }
      else if (key === "Enter" && practice && !submitted && !isRevealed && selected !== undefined) { e.preventDefault(); check(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, showSubmit, q, choose, goNextInFilter, submitted, practice, isRevealed, selected, check, onToggleFlag]);

  if (!q) return null;

  const unansweredNumbers = questions.map((qq, i) => (answers[qq.id] === undefined ? i + 1 : null)).filter(Boolean);
  const flaggedNumbers = questions.map((qq, i) => (flagged.has(qq.id) ? i + 1 : null)).filter(Boolean);
  const isLast = currentIdx >= questions.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg-app text-text-primary">
      {/* Calculator and tables: floating buttons, kept to wide screens where they don't cover the controls */}
      {!submitted && <div className="hidden lg:block"><ExamTools /></div>}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border-subtle bg-bg-panel">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
          <button type="button" onClick={exit} className="acx-icon-btn shrink-0" aria-label={submitted ? "Back to practice" : "Leave session"}>
            {submitted ? <ArrowLeft size={16} /> : <X size={16} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate text-text-muted">
              {set.courseCode}
              <span className="hidden sm:inline"> · {practice ? "Practice" : "Timed exam"}</span>
            </p>
            <p className="truncate text-sm font-semibold leading-tight">{set.courseTitle}</p>
          </div>

          {submitted ? (
            score && <span className="num shrink-0 rounded-full bg-bg-panel-alt px-3 py-1.5 text-sm font-semibold">{score.correct}/{score.total} · {score.pct}%</span>
          ) : (
            <>
              <span className="num hidden shrink-0 text-sm text-text-muted md:inline">{stats.answered} of {questions.length} answered</span>
              {timeLeft != null && (
                <span
                  role="timer"
                  aria-label={`Time left ${formatClock(timeLeft)}`}
                  className={`num inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums ${lowTime ? "border-status-danger/40 bg-status-danger/10 text-status-danger" : "border-border-subtle bg-bg-panel-alt"}`}
                >
                  <Timer size={14} /> {formatClock(timeLeft)}
                </span>
              )}
              <button type="button" onClick={() => setShowSubmit(true)} className="acx-btn shrink-0 !px-3.5 sm:!px-4">Submit</button>
            </>
          )}
        </div>
        {!submitted && (
          <div className="h-[3px] bg-bg-elevated" aria-hidden="true">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${stats.progressPct}%` }} />
          </div>
        )}
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {view === "results" && submitted ? (
          <Results
            set={set}
            questions={questions}
            answers={answers}
            score={score}
            elapsedSec={elapsedSec}
            totalTime={totalTime}
            practice={practice}
            onReview={(filter) => { setReviewFilter(filter); setView("paper"); const first = filter === "wrong" ? questions.findIndex((qq) => statusOf(qq) === "wrong") : 0; go(Math.max(0, first)); }}
            onRetake={onRetake}
            onExit={onExit}
          />
        ) : (
          <div className="mx-auto grid max-w-6xl gap-6 px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:pb-10">
            <main className="min-w-0">
              {submitted && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setView("results")} className="acx-btn-ghost"><ArrowLeft size={14} /> Results</button>
                  <span className="text-sm text-text-muted">Reviewing answers</span>
                </div>
              )}

              <article className="rounded-[1.4rem] border border-border-subtle bg-bg-panel p-4 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow text-text-muted">Question {currentIdx + 1} <span className="opacity-60">of {questions.length}</span></p>
                  {q.topic && <span className="acx-chip-sm">{q.topic}</span>}
                  {q.difficulty && <span className="acx-chip-sm capitalize">{q.difficulty}</span>}
                  {q.marks ? <span className="acx-chip-sm">{q.marks} mark{q.marks > 1 ? "s" : ""}</span> : null}
                  {!submitted && (
                    <button
                      type="button"
                      onClick={() => onToggleFlag(q.id)}
                      aria-pressed={isFlagged}
                      className={`ml-auto hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition sm:inline-flex ${isFlagged ? "border-status-warning/50 bg-lemon-soft text-midnight dark:bg-lemon/10 dark:text-lemon" : "border-border-subtle text-text-secondary hover:border-text-muted"}`}
                    >
                      <Flag size={13} className={isFlagged ? "fill-current" : ""} /> {isFlagged ? "Flagged" : "Flag for review"}
                    </button>
                  )}
                </div>

                <h2 className="mt-4 whitespace-pre-line text-[1.08rem] font-medium leading-relaxed text-text-primary sm:text-[1.22rem]">{q.questionText}</h2>
                {q.referenceCode && <p className="mt-2 font-mono text-xs text-text-muted">Ref. {q.referenceCode}</p>}

                <div className="mt-5 grid gap-2.5" role="radiogroup" aria-label={`Options for question ${currentIdx + 1}`}>
                  {(q.options || []).map((opt, idx) => (
                    <OptionCard
                      key={idx}
                      letter={letterOf(idx)}
                      text={opt}
                      chosen={selected === idx}
                      correct={idx === q.correctIndex}
                      revealed={isRevealed}
                      locked={isRevealed}
                      onChoose={() => choose(idx)}
                    />
                  ))}
                </div>

                {/* Practice: check this one now */}
                {practice && !submitted && !isRevealed && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={check} disabled={selected === undefined} className="acx-btn-ghost disabled:cursor-not-allowed">
                      <Check size={14} /> Check answer
                    </button>
                    {q.explanation && (
                      <button type="button" onClick={() => setShowHint((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium text-text-secondary hover:text-text-primary">
                        <Lightbulb size={14} /> {showHint ? "Hide hint" : "Hint"}
                      </button>
                    )}
                    {selected !== undefined && (
                      <button type="button" onClick={() => onClearAnswer(q.id)} className="ml-auto text-[0.8rem] font-medium text-text-muted hover:text-text-primary">Clear choice</button>
                    )}
                  </div>
                )}
                {!practice && !submitted && selected !== undefined && (
                  <div className="mt-3 text-right">
                    <button type="button" onClick={() => onClearAnswer(q.id)} className="text-[0.8rem] font-medium text-text-muted hover:text-text-primary">Clear choice</button>
                  </div>
                )}

                {showHint && !isRevealed && q.explanation && (
                  <div className="mt-4 rounded-xl border-l-[3px] border-lemon-deep bg-bg-panel-alt px-4 py-3 text-sm leading-relaxed text-text-secondary">
                    <p className="mb-1 text-xs font-semibold text-text-primary">Hint</p>
                    {q.explanation.length > 140 ? `${q.explanation.slice(0, 140).trim()}…` : q.explanation}
                  </div>
                )}

                {isRevealed && (
                  <Verdict q={q} selected={selected} />
                )}

                {/* Desktop pager */}
                <div className="mt-7 hidden items-center justify-between gap-3 border-t border-border-subtle pt-4 sm:flex">
                  <button type="button" onClick={() => goNextInFilter(-1)} disabled={currentIdx === 0} className="acx-btn-ghost disabled:invisible"><ChevronLeft size={15} /> Previous</button>
                  {!submitted && isLast ? (
                    <button type="button" onClick={() => setShowSubmit(true)} className="acx-btn">Review and submit</button>
                  ) : (
                    <button type="button" onClick={() => goNextInFilter(1)} disabled={isLast} className="acx-btn disabled:opacity-40">Next <ChevronRight size={15} /></button>
                  )}
                </div>
              </article>

              <p className="mt-3 hidden items-center gap-2 px-1 text-xs text-text-muted lg:flex">
                <Keyboard size={13} />
                <Kbd>A</Kbd>–<Kbd>D</Kbd> choose · <Kbd>N</Kbd>/<Kbd>P</Kbd> next, previous{!submitted && <> · <Kbd>F</Kbd> flag</>}{practice && !submitted && <> · <Kbd>Enter</Kbd> check · <Kbd>H</Kbd> hint</>}
              </p>
            </main>

            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <Navigator
                  questions={questions}
                  currentIdx={currentIdx}
                  statusOf={statusOf}
                  flagged={flagged}
                  submitted={submitted}
                  filter={reviewFilter}
                  setFilter={setReviewFilter}
                  onPick={go}
                />
                <div className="rounded-[1.2rem] border border-border-subtle bg-bg-panel px-4 py-3 text-xs">
                  <Row k="Candidate" v={profile?.displayName || profile?.name || "Student"} />
                  {profile?.uniqueId && <Row k="ID" v={<span className="font-mono">{profile.uniqueId}</span>} />}
                  <Row k="Mode" v={practice ? "Practice" : "Timed exam"} />
                  {totalTime ? <Row k="Time allowed" v={formatDuration(totalTime)} /> : null}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* ── Mobile control bar ─────────────────────────────────── */}
      {view === "paper" && (
        <nav className="shrink-0 border-t border-border-subtle bg-bg-panel px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 lg:hidden" aria-label="Question controls">
          <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
            <BarButton onClick={() => goNextInFilter(-1)} disabled={currentIdx === 0} label="Previous"><ChevronLeft size={18} /></BarButton>
            <BarButton onClick={() => setNavOpen(true)} label={`${currentIdx + 1} / ${questions.length}`}><Grid3X3 size={17} /></BarButton>
            {!submitted ? (
              <BarButton onClick={() => onToggleFlag(q.id)} label={isFlagged ? "Flagged" : "Flag"} active={isFlagged}><Flag size={17} className={isFlagged ? "fill-current" : ""} /></BarButton>
            ) : (
              <BarButton onClick={() => setView("results")} label="Results"><RotateCcw size={17} /></BarButton>
            )}
            {!submitted && isLast ? (
              <BarButton onClick={() => setShowSubmit(true)} label="Submit" primary><Check size={18} /></BarButton>
            ) : (
              <BarButton onClick={() => goNextInFilter(1)} disabled={isLast} label="Next" primary><ChevronRight size={18} /></BarButton>
            )}
          </div>
        </nav>
      )}

      {navOpen && (
        <div className="fixed inset-0 z-[85] flex items-end bg-midnight/55 backdrop-blur-[2px] lg:hidden" onClick={() => setNavOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Questions" onClick={(e) => e.stopPropagation()} className="animate-pop max-h-[78vh] w-full overflow-y-auto rounded-t-[1.5rem] bg-bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" aria-hidden="true" />
            <Navigator
              bare
              questions={questions}
              currentIdx={currentIdx}
              statusOf={statusOf}
              flagged={flagged}
              submitted={submitted}
              filter={reviewFilter}
              setFilter={setReviewFilter}
              onPick={(i) => { go(i); setNavOpen(false); }}
            />
            {!submitted && (
              <button type="button" onClick={() => { setNavOpen(false); setShowSubmit(true); }} className="acx-btn mt-4 w-full justify-center !py-3">Submit paper</button>
            )}
          </div>
        </div>
      )}

      <CbtSubmitModal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        onConfirm={() => { setShowSubmit(false); onSubmit(); }}
        onJump={(i) => { setShowSubmit(false); go(i); }}
        stats={stats}
        timeLeft={timeLeft}
        courseLabel={`${set.courseCode} · ${practice ? "Practice" : "Timed exam"}`}
        total={questions.length}
        unansweredNumbers={unansweredNumbers}
        flaggedNumbers={flaggedNumbers}
      />
    </div>
  );
}

function OptionCard({ letter, text, chosen, correct, revealed, locked, onChoose }) {
  let box = "border-border-subtle bg-bg-panel hover:border-text-muted";
  let key = "border-border-strong text-text-secondary";
  let tag = null;
  if (chosen && !revealed) {
    box = "border-accent bg-accent-soft";
    key = "border-midnight bg-midnight text-white dark:border-lemon dark:bg-lemon dark:text-midnight";
  }
  if (revealed) {
    if (correct) {
      box = "border-status-success bg-aqua-soft/60 dark:bg-aqua/10";
      key = "border-status-success bg-status-success text-white";
      tag = chosen ? "Your answer · correct" : "Correct answer";
    } else if (chosen) {
      box = "border-status-danger/70 bg-status-danger/[0.07]";
      key = "border-status-danger bg-status-danger text-white";
      tag = "Your answer";
    } else {
      box = "border-border-subtle bg-bg-panel opacity-70";
    }
  }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={locked}
      onClick={onChoose}
      className={`group flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-default sm:px-4 sm:py-3.5 ${box}`}
    >
      <span className={`num mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[0.8rem] font-semibold transition ${key}`}>{letter}</span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block whitespace-pre-line text-[0.95rem] leading-snug text-text-primary">{text}</span>
        {tag && <span className={`mt-1 block text-[0.72rem] font-semibold ${correct ? "text-status-success" : "text-status-danger"}`}>{tag}</span>}
      </span>
    </button>
  );
}

function Verdict({ q, selected }) {
  const skipped = selected === undefined;
  const right = selected === q.correctIndex;
  const correctText = q.options?.[q.correctIndex];
  return (
    <div className="mt-5 rounded-2xl border border-border-subtle bg-bg-panel-alt p-4">
      <p className={`text-sm font-semibold ${right ? "text-status-success" : skipped ? "text-text-secondary" : "text-status-danger"}`}>
        {right ? "Correct." : skipped ? "Not answered." : "Not quite."}
        {!right && correctText != null && <span className="font-normal text-text-secondary"> The answer is <strong className="font-semibold text-text-primary">{letterOf(q.correctIndex)}</strong>: {correctText}</span>}
      </p>
      {q.explanation ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{q.explanation}</p>
      ) : (
        <p className="mt-2 text-sm text-text-muted">No explanation has been added for this question yet.</p>
      )}
    </div>
  );
}

const CELL = {
  blank: "border-border-subtle bg-bg-panel text-text-secondary",
  answered: "border-midnight bg-midnight text-white dark:border-violet dark:bg-violet",
  correct: "border-status-success bg-status-success text-white",
  wrong: "border-status-danger bg-status-danger text-white",
  skipped: "border-dashed border-border-strong bg-bg-panel text-text-muted",
};

function Navigator({ questions, currentIdx, statusOf, flagged, submitted, filter, setFilter, onPick, bare }) {
  const filters = submitted
    ? [["all", "All"], ["wrong", "Wrong"], ["skipped", "Skipped"], ["flagged", "Flagged"]]
    : [["all", "All"], ["blank", "Blank"], ["flagged", "Flagged"]];
  const active = filters.some(([k]) => k === filter) ? filter : "all";
  const keep = (qq) => {
    const s = statusOf(qq);
    if (active === "all") return true;
    if (active === "flagged") return flagged.has(qq.id);
    return s === active;
  };
  const counts = questions.reduce((acc, qq) => { const s = statusOf(qq); acc[s] = (acc[s] || 0) + 1; return acc; }, {});

  return (
    <div className={bare ? "" : "rounded-[1.2rem] border border-border-subtle bg-bg-panel p-4"}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-text-primary">Questions</p>
        <p className="num text-xs text-text-muted">
          {submitted ? `${counts.correct || 0} right · ${counts.wrong || 0} wrong` : `${(counts.answered || 0) + (counts.correct || 0) + (counts.wrong || 0)} of ${questions.length} done`}
        </p>
      </div>
      <div className="mt-3 flex gap-1 rounded-full bg-bg-panel-alt p-1 text-xs font-medium">
        {filters.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`flex-1 rounded-full px-2 py-1.5 transition ${active === k ? "bg-bg-panel text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>{label}</button>
        ))}
      </div>
      <div className="mt-3 grid max-h-[46vh] grid-cols-6 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((qq, i) => {
          if (!keep(qq)) return null;
          const s = statusOf(qq);
          return (
            <button
              key={qq.id || i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Question ${i + 1}, ${s}${flagged.has(qq.id) ? ", flagged" : ""}`}
              aria-current={i === currentIdx ? "true" : undefined}
              className={`num relative flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition hover:opacity-90 ${CELL[s]} ${i === currentIdx ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-panel" : ""}`}
            >
              {i + 1}
              {flagged.has(qq.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-bg-panel bg-status-warning" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-text-muted">
        {submitted ? (
          <>
            <Legend cls={CELL.correct}>Correct</Legend>
            <Legend cls={CELL.wrong}>Wrong</Legend>
            <Legend cls={CELL.skipped}>Skipped</Legend>
          </>
        ) : (
          <>
            <Legend cls={CELL.answered}>Answered</Legend>
            <Legend cls={CELL.blank}>Blank</Legend>
          </>
        )}
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-warning" /> Flagged</span>
      </div>
    </div>
  );
}

function Results({ set, questions, answers, score, elapsedSec, totalTime, practice, onReview, onRetake, onExit }) {
  const pct = score?.pct ?? 0;
  const wrong = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== q.correctIndex).length;
  const skipped = questions.filter((q) => answers[q.id] === undefined).length;
  const verdict = pct >= 70 ? "A strong paper." : pct >= 50 ? "A pass, with room to grow." : "Worth another go.";
  const note = pct >= 70
    ? "Keep the habit going. Try a timed run with more questions to test yourself under pressure."
    : pct >= 50
      ? "Go through the ones you missed below, then retake while it's fresh."
      : "Read the explanations for the questions you missed, then try again in practice mode.";

  const topics = useMemo(() => {
    const map = new Map();
    questions.forEach((q) => {
      if (!q.topic) return;
      const t = map.get(q.topic) || { topic: q.topic, right: 0, total: 0 };
      t.total += 1;
      if (answers[q.id] === q.correctIndex) t.right += 1;
      map.set(q.topic, t);
    });
    return [...map.values()].sort((a, b) => a.right / a.total - b.right / b.total);
  }, [questions, answers]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <section className="rounded-[1.6rem] border border-border-subtle bg-bg-panel p-6 sm:p-9">
        <p className="eyebrow text-text-muted">{set.courseCode} · {practice ? "Practice" : "Timed exam"} · results</p>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="font-display text-[4.2rem] font-[380] leading-none tracking-[-0.04em] text-text-primary sm:text-[5.2rem]">{pct}<span className="text-[0.45em] text-text-muted">%</span></p>
          <div className="pb-2">
            <p className="font-display text-[1.5rem] font-[420] leading-tight tracking-[-0.02em]">{verdict}</p>
            <p className="mt-1 text-sm text-text-secondary">You got {score?.correct ?? 0} of {score?.total ?? questions.length} right.</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
          <div className="h-full rounded-full bg-status-success" style={{ width: `${pct}%` }} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-4">
          <Stat k="Correct" v={score?.correct ?? 0} tone="text-status-success" />
          <Stat k="Wrong" v={wrong} tone="text-status-danger" />
          <Stat k="Skipped" v={skipped} />
          <Stat k="Time taken" v={elapsedSec != null ? formatDuration(elapsedSec) : "—"} small sub={totalTime ? `of ${formatDuration(totalTime)}` : null} />
        </dl>

        <p className="mt-5 text-sm leading-relaxed text-text-secondary">{note}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {wrong > 0 && <button type="button" onClick={() => onReview("wrong")} className="acx-btn justify-center !py-2.5">Review what I missed</button>}
          <button type="button" onClick={() => onReview("all")} className={`${wrong > 0 ? "acx-btn-ghost" : "acx-btn"} justify-center !py-2.5`}>Review all answers</button>
          {onRetake && <button type="button" onClick={onRetake} className="acx-btn-ghost justify-center !py-2.5"><RotateCcw size={14} /> Retake</button>}
          <button type="button" onClick={onExit} className="acx-btn-ghost justify-center !py-2.5 sm:ml-auto">Back to practice</button>
        </div>
      </section>

      {topics.length > 1 && (
        <section className="mt-5 rounded-[1.6rem] border border-border-subtle bg-bg-panel p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-text-primary">By topic</h3>
          <p className="mt-0.5 text-xs text-text-muted">Weakest first, so you know where to spend your next session.</p>
          <ul className="mt-4 space-y-3">
            {topics.map((t) => {
              const p = Math.round((t.right / t.total) * 100);
              return (
                <li key={t.topic}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-text-primary">{t.topic}</span>
                    <span className="num shrink-0 text-xs text-text-muted">{t.right}/{t.total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                    <div className={`h-full rounded-full ${p >= 70 ? "bg-status-success" : p >= 50 ? "bg-lemon-deep" : "bg-status-danger"}`} style={{ width: `${Math.max(p, 3)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ k, v, tone = "text-text-primary", small, sub }) {
  return (
    <div className="bg-bg-panel px-4 py-3.5">
      <dt className="text-[0.72rem] text-text-muted">{k}</dt>
      <dd className={`num mt-1 font-semibold ${small ? "text-base" : "text-2xl"} ${tone}`}>{v}</dd>
      {sub && <dd className="text-[0.7rem] text-text-muted">{sub}</dd>}
    </div>
  );
}

function BarButton({ children, label, onClick, disabled, primary, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[0.68rem] font-medium transition disabled:opacity-35 ${primary ? "bg-midnight text-white dark:bg-lemon dark:text-midnight" : active ? "bg-lemon-soft text-midnight dark:bg-lemon/15 dark:text-lemon" : "bg-bg-panel-alt text-text-secondary"}`}
    >
      {children}
      <span className="num">{label}</span>
    </button>
  );
}

function Legend({ cls, children }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-[3px] border ${cls}`} /> {children}</span>;
}

function Kbd({ children }) {
  return <kbd className="rounded border border-border-subtle bg-bg-panel px-1.5 py-px font-mono text-[0.68rem] text-text-secondary">{children}</kbd>;
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-text-muted">{k}</span>
      <span className="truncate text-right font-medium text-text-primary">{v}</span>
    </div>
  );
}
