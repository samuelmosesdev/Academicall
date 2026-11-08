import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Calculator, ChevronLeft, ChevronRight, Flag, Send, Timer, LogOut, Grid3X3, X, RotateCcw, ListChecks, Lightbulb,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { appConfirm, notify } from "../lib/dialogs";
import { formatClock, liveSession, scoreSession, utmeApi } from "../lib/utmeBank";
import ReportQuestion from "../components/utme/ReportQuestion";
import UtmeQuestion from "../components/utme/UtmeQuestion";
import UtmeCalculator from "../components/utme/UtmeCalculator";

const LETTER_KEYS = { a: 0, b: 1, c: 2, d: 3, e: 4 };

/** Full-screen JAMB-style CBT. The session is built on /dashboard/utme and kept in sessionStorage. */
export default function UtmeExam() {
  const [session, setSession] = useState(() => liveSession.get());
  if (!session) return <Navigate to="/dashboard/utme" replace />;
  return session.result ? <UtmeResult session={session} /> : <ExamRoom session={session} setSession={setSession} />;
}

function ExamRoom({ session, setSession }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [calc, setCalc] = useState(false);
  const [palette, setPalette] = useState(false);
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);
  const practice = session.style === "practice";
  const { questions, answers, current } = session;
  const q = questions[current];
  const flags = useMemo(() => new Set(session.flags || []), [session.flags]);
  const subj = session.subjects.find((s) => s.slug === q.slug);
  const subjQs = useMemo(() => questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => qq.slug === q.slug), [questions, q.slug]);
  const posInSubject = subjQs.findIndex(({ i }) => i === current) + 1;

  const update = useCallback((patch) => {
    setSession((s) => {
      const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
      liveSession.set(next);
      return next;
    });
  }, [setSession]);

  const endAt = session.timeLimitSec ? session.startedAt + session.timeLimitSec * 1000 : null;
  const left = endAt ? Math.max(0, Math.round((endAt - now) / 1000)) : null;
  const elapsed = Math.round((now - session.startedAt) / 1000);

  const finish = useCallback(async (reason) => {
    if (submitting.current) return;
    submitting.current = true;
    const s = liveSession.get() || session;
    const result = scoreSession(s, s.answers);
    const durationSec = Math.min(Math.round((Date.now() - s.startedAt) / 1000), s.timeLimitSec || Infinity);
    const finished = { ...s, result, durationSec, finishedAt: Date.now(), reason };
    liveSession.set(finished);
    setSession(finished);
    try {
      const compact = {};
      const topicStats = {};
      const missed = [];
      for (const qq of s.questions) {
        const chosen = s.answers[qq.key] ?? -1;
        compact[qq.key] = chosen;
        const topic = s.topicNames?.[qq.slug]?.[qq.t];
        if (topic && chosen !== -1) {
          const pair = ((topicStats[qq.slug] ||= {})[topic] ||= [0, 0]);
          pair[0] += 1;
          if (chosen === qq.a) pair[1] += 1;
        }
        if (chosen !== -1 && chosen !== qq.a) missed.push(qq.key);
      }
      await utmeApi.save({
        mode: s.mode,
        style: s.style,
        subjects: result.per,
        config: { countMode: s.countMode, years: s.years, topics: Object.fromEntries(s.subjects.map((x) => [x.slug, x.topicNames || []])) },
        answers: compact,
        topicStats,
        missed,
        durationSec,
        timeLimitSec: s.timeLimitSec,
      });
    } catch { /* history is a bonus; the result still shows */ }
  }, [session, setSession]);

  // clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) { notify.info("Time up. Your answers have been submitted."); finish("time"); }
  }, [left, finish]);

  // stop accidental tab close mid-exam
  useEffect(() => {
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const go = useCallback((i) => update({ current: Math.max(0, Math.min(questions.length - 1, i)) }), [questions.length, update]);
  const choose = useCallback((i) => {
    if (i >= q.o.length) return;
    if (practice && answers[q.key] != null) return; // practice locks after the first pick
    update((s) => ({ answers: { ...s.answers, [q.key]: i } }));
  }, [answers, practice, q, update]);
  const toggleFlag = () => update((s) => {
    const set = new Set(s.flags || []);
    if (set.has(q.key)) set.delete(q.key);
    else set.add(q.key);
    return { flags: [...set] };
  });

  const answeredCount = Object.keys(answers).length;
  async function askSubmit() {
    const unanswered = questions.length - answeredCount;
    const ok = await appConfirm(
      unanswered ? `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?` : "Submit your answers now? You can't change them after this.",
      { confirmLabel: "Submit", title: "Submit CBT" },
    );
    if (ok) finish("submit");
  }
  async function quit() {
    const ok = await appConfirm("Leave the exam room? Your progress is kept on this device so you can continue.", { confirmLabel: "Leave" });
    if (ok) navigate("/dashboard/utme");
  }

  // JAMB keyboard: A–E answer, N next, P previous, S submit, F flag
  useEffect(() => {
    const onKey = (e) => {
      if (calc || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k in LETTER_KEYS) { choose(LETTER_KEYS[k]); e.preventDefault(); }
      else if (k === "n" || e.key === "ArrowRight") go(current + 1);
      else if (k === "p" || e.key === "ArrowLeft") go(current - 1);
      else if (k === "s") askSubmit();
      else if (k === "f") toggleFlag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const passage = q.p != null ? session.passages[`${q.slug}:${q.p}`] : null;
  const revealed = practice && answers[q.key] != null;
  const low = left != null && left <= 300;
  const name = profile?.name || profile?.nickname || "Candidate";
  const photo = profile?.photoUrl || profile?.avatarUrl;

  const Palette = (
    <div className="utme-palette">
      <div className="utme-palette-head">
        <p className="font-semibold">{subj?.name}</p>
        <p className="num text-xs opacity-75">{subjQs.filter(({ qq }) => answers[qq.key] != null).length}/{subjQs.length} answered</p>
      </div>
      <div className="utme-grid">
        {subjQs.map(({ qq, i }, n) => {
          const a = answers[qq.key];
          const st = practice && a != null ? (a === qq.a ? "is-right" : "is-wrong") : a != null ? "is-done" : "";
          return (
            <button key={qq.key} type="button" onClick={() => { go(i); setPalette(false); }} className={`utme-cell num ${st} ${i === current ? "is-current" : ""} ${flags.has(qq.key) ? "is-flag" : ""}`} aria-label={`Question ${n + 1}`}>
              {n + 1}
            </button>
          );
        })}
      </div>
      <div className="utme-legend">
        <span><i className="is-done" /> Answered</span>
        <span><i /> Not yet</span>
        <span><i className="is-flag" /> Flagged</span>
      </div>
    </div>
  );

  return (
    <div className="utme-room">
      <header className="utme-top">
        <div className="utme-top-in">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/mark-full-color.png" alt="" className="h-8 w-8 rounded-[3px] bg-white p-0.5" />
            <div className="min-w-0 leading-tight">
              <p className="font-logo text-[0.98rem] font-bold">academicall</p>
              <p className="whitespace-nowrap text-xs text-white/60">UTME CBT<span className="hidden sm:inline"> · {practice ? "Practice" : "Timed"}</span></p>
            </div>
          </div>
          <div className="utme-candidate">
            {photo ? <img src={photo} alt="" /> : <span>{name.slice(0, 1)}</span>}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-white/60">Candidate</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`utme-timer ${low ? "is-low" : ""}`} aria-live={low ? "polite" : "off"}>
              <Timer size={16} />
              <span className="num">{left != null ? formatClock(left) : formatClock(elapsed)}</span>
              <span className="hidden text-[0.7rem] font-medium opacity-70 sm:inline">{left != null ? "left" : "elapsed"}</span>
            </div>
            <button type="button" onClick={() => setCalc((v) => !v)} className={`utme-topbtn ${calc ? "is-on" : ""}`} aria-pressed={calc}><Calculator size={16} /><span className="hidden md:inline">Calculator</span></button>
            <button type="button" onClick={quit} className="utme-topbtn" aria-label="Leave exam"><LogOut size={16} /></button>
          </div>
        </div>
        {session.subjects.length > 1 && (
          <nav className="utme-tabs" aria-label="Subjects">
            {session.subjects.map((s) => {
              const first = questions.findIndex((qq) => qq.slug === s.slug);
              const done = questions.filter((qq) => qq.slug === s.slug && answers[qq.key] != null).length;
              return (
                <button key={s.slug} type="button" onClick={() => go(s.slug === q.slug ? current : first)} className={s.slug === q.slug ? "is-on" : ""}>
                  {s.name} <span className="num">{done}/{s.count}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="utme-main">
        <section className="utme-sheet">
          <div className="utme-sheet-head">
            <p><span className="font-semibold text-text-primary">Question <span className="num">{posInSubject}</span></span> <span className="text-text-muted">of <span className="num">{subjQs.length}</span></span></p>
            <span className="utme-yearchip">{subj?.name} · JAMB {q.y}</span>
            <button type="button" onClick={toggleFlag} className={`utme-flag ${flags.has(q.key) ? "is-on" : ""}`}><Flag size={14} /> {flags.has(q.key) ? "Flagged" : "Flag"}</button>
          </div>
          <UtmeQuestion q={q} number={posInSubject} selected={answers[q.key]} onSelect={choose} reveal={revealed} passage={passage} rtl={subj?.rtl} />
          {practice && !revealed && <p className="mt-4 flex items-center gap-1.5 text-xs text-text-muted"><Lightbulb size={13} /> Pick an option to see the answer and why.</p>}
          <div className="utme-nav">
            <button type="button" onClick={() => go(current - 1)} disabled={current === 0} className="utme-navbtn"><ChevronLeft size={17} /> Previous</button>
            <button type="button" onClick={() => setPalette(true)} className="utme-navbtn is-grid"><Grid3X3 size={16} /> <span className="num">{current + 1}/{questions.length}</span></button>
            {current < questions.length - 1
              ? <button type="button" onClick={() => go(current + 1)} className="utme-navbtn is-primary">Next <ChevronRight size={17} /></button>
              : <button type="button" onClick={askSubmit} className="utme-navbtn is-submit"><Send size={16} /> Submit</button>}
          </div>
        </section>

        <aside className="utme-side">
          {Palette}
          <div className="utme-sidecard">
            <div className="flex items-center justify-between text-sm"><span className="text-text-secondary">Answered</span><b className="num text-text-primary">{answeredCount} / {questions.length}</b></div>
            <div className="utme-progress"><span style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
            <button type="button" onClick={askSubmit} className="utme-submit"><Send size={16} /> Submit {practice ? "session" : "CBT"}</button>
            <p className="mt-3 text-xs leading-relaxed text-text-muted">A–E answer · N next · P previous · F flag · S submit</p>
          </div>
        </aside>
      </main>

      {palette && (
        <div className="utme-sheet-modal lg:hidden" onClick={() => setPalette(false)}>
          <div className="utme-sheet-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-semibold text-text-primary">Questions</p><button type="button" onClick={() => setPalette(false)} aria-label="Close"><X size={18} /></button></div>
            {Palette}
            <button type="button" onClick={() => { setPalette(false); askSubmit(); }} className="utme-submit mt-3"><Send size={16} /> Submit</button>
          </div>
        </div>
      )}

      {calc && <UtmeCalculator onClose={() => setCalc(false)} />}
    </div>
  );
}

// ── result + review ─────────────────────────────────────────────────────────
function UtmeResult({ session }) {
  const navigate = useNavigate();
  const { result } = session;
  const [filter, setFilter] = useState("wrong");
  const [subject, setSubject] = useState(session.subjects[0].slug);
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const verdict = pct >= 75 ? "Excellent work" : pct >= 60 ? "Strong session" : pct >= 45 ? "Getting there" : "Keep practising";

  const list = session.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.slug === subject)
    .filter(({ q }) => {
      const a = session.answers[q.key];
      if (filter === "wrong") return a != null && a !== q.a;
      if (filter === "skipped") return a == null;
      if (filter === "right") return a === q.a;
      return true;
    });

  function again() {
    liveSession.clear();
    navigate("/dashboard/utme");
  }

  return (
    <div className="utme-room">
      <header className="utme-top">
        <div className="utme-top-in">
          <div className="flex items-center gap-2.5">
            <img src="/brand/mark-full-color.png" alt="" className="h-8 w-8 rounded-[3px] bg-white p-0.5" />
            <p className="font-logo text-[0.98rem] font-bold">academicall <span className="ml-1 font-sans text-xs font-normal text-white/60">UTME CBT result</span></p>
          </div>
          <Link to="/dashboard/utme" onClick={() => liveSession.clear()} className="utme-topbtn ml-auto"><LogOut size={16} /><span className="hidden sm:inline">Done</span></Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="utme-score">
          <div className="utme-score-main">
            <p className="text-sm text-white/65">{session.reason === "time" ? "Time up · auto-submitted" : verdict}</p>
            <p className="mt-2 font-display text-[3.4rem] leading-none"><span className="num">{result.score}</span><span className="text-[1.6rem] text-white/55"> / {result.maxScore}</span></p>
            <p className="mt-3 text-sm text-white/70"><span className="num">{result.correct}</span> of <span className="num">{result.total}</span> correct · <span className="num">{pct}%</span> · {formatClock(session.durationSec)} spent</p>
          </div>
          <div className="utme-score-subjects">
            {result.per.map((s) => (
              <div key={s.slug} className="utme-bar">
                <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-semibold">{s.name}</span><span className="num shrink-0"><b>{s.score}</b><span className="opacity-60">/100</span></span></div>
                <div className="utme-bar-track"><span style={{ width: `${s.score}%` }} className={s.score >= 70 ? "is-good" : s.score >= 50 ? "is-mid" : "is-low"} /></div>
                <p className="num text-xs opacity-60">{s.correct} of {s.total} correct</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={again} className="utme-navbtn is-primary"><RotateCcw size={16} /> New session</button>
        </div>

        <section className="acx-card !p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
            <ListChecks size={17} className="text-violet" />
            <h2 className="mr-auto font-semibold text-text-primary">Review answers</h2>
            {session.subjects.length > 1 && (
              <select className="field !w-auto !py-1.5 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {session.subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            )}
            <div className="utme-filter">
              {[["wrong", "Wrong"], ["skipped", "Skipped"], ["right", "Right"], ["all", "All"]].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFilter(id)} className={filter === id ? "is-on" : ""}>{label}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border-subtle">
            {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-text-secondary">Nothing here. {filter === "wrong" ? "No wrong answers in this subject." : ""}</p>}
            {list.map(({ q }) => {
              const n = session.questions.filter((x) => x.slug === q.slug).indexOf(q) + 1;
              return (
                <div key={q.key} className="px-4 py-5 sm:px-6">
                  <p className="mb-2 flex items-center gap-2 text-xs text-text-muted">JAMB {q.y} · {session.topicNames?.[q.slug]?.[q.t]}<ReportQuestion slug={q.slug} qid={q.id} /></p>
                  <UtmeQuestion q={q} number={n} selected={session.answers[q.key]} reveal passage={q.p != null ? session.passages[`${q.slug}:${q.p}`] : null} />
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
