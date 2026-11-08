/**
 * Taking a General test (full screen, same CBT room as UTME practice).
 * The server holds the clock and the answer key: we autosave as you go and
 * the server marks the paper when you submit (or when time runs out).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calculator, ChevronLeft, ChevronRight, Flag, Send, Timer, LogOut, Grid3X3, X, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { appConfirm, notify } from "../lib/dialogs";
import { formatClock } from "../lib/utmeBank";
import { testsApi } from "../lib/gapsApi";
import UtmeQuestion from "../components/utme/UtmeQuestion";
import UtmeCalculator from "../components/utme/UtmeCalculator";

const LETTER_KEYS = { a: 0, b: 1, c: 2, d: 3, e: 4 };
const draftKey = (id) => `ac.test.${id}`;

export default function TestExam() {
  const { id } = useParams();
  const [state, setState] = useState(null); // { attempt, test, questions }
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    testsApi.start(id).then((r) => {
      // Keep answers typed while offline across refreshes.
      try {
        const local = JSON.parse(localStorage.getItem(draftKey(id)) || "null");
        if (local?.attemptId === r.attempt.id) r.attempt.answers = { ...(r.attempt.answers || {}), ...local.answers };
      } catch { /* ignore */ }
      r.offset = Date.parse(r.attempt.serverNow) - Date.now();
      setState(r);
    }).catch((e) => {
      if (/already taken|used all/i.test(e.message)) testsApi.result(id).then(setResult).catch(() => setErr(e.message));
      else setErr(e.message);
    });
  }, [id]);

  if (result) return <TestResult result={result} />;
  if (err) return <div className="utme-room"><main className="mx-auto max-w-lg p-8 text-center"><p className="ctl-error">{err}</p><Link to="/dashboard/tests" className="ctl-btn mt-4">Back to tests</Link></main></div>;
  if (!state) return <div className="flex min-h-screen items-center justify-center text-sm text-text-muted"><Loader2 size={16} className="mr-2 animate-spin" /> Opening the test…</div>;
  return <Room data={state} onDone={setResult} />;
}

function Room({ data, onDone }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { test, questions, attempt } = data;
  const [answers, setAnswers] = useState(attempt.answers || {});
  const [current, setCurrent] = useState(0);
  const [flags, setFlags] = useState(() => new Set());
  const [now, setNow] = useState(Date.now());
  const [calc, setCalc] = useState(false);
  const [palette, setPalette] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const dirty = useRef(false);

  const deadline = Date.parse(attempt.deadlineAt) - (data.offset || 0);
  const left = Math.max(0, Math.round((deadline - now) / 1000));
  const low = left < 300;
  const q = questions[current];
  const sections = test.sections || [];
  const section = sections.find((s) => s.key === q?.section);
  const secQs = useMemo(() => questions.map((qq, i) => ({ qq, i })).filter(({ qq }) => qq.section === q?.section), [questions, q?.section]);
  const pos = secQs.findIndex(({ i }) => i === current) + 1;
  const answeredCount = Object.values(answers).filter((v) => v != null && v !== -1).length;

  const persist = useCallback((next) => {
    localStorage.setItem(draftKey(test.id), JSON.stringify({ attemptId: attempt.id, answers: next }));
  }, [test.id, attempt.id]);

  const save = useCallback(async () => {
    if (!dirty.current || submitting.current) return;
    dirty.current = false;
    setSaving(true);
    try { await testsApi.save(test.id, answers); } catch (e) { dirty.current = true; if (e.data?.code === "time_up") submit("time"); } finally { setSaving(false); }
  }, [answers, test.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async (reason) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const r = await testsApi.submit(test.id, answers);
      localStorage.removeItem(draftKey(test.id));
      if (reason === "time") notify.info("Time up. Your answers were submitted.");
      onDone({ ...r, title: test.title });
    } catch (e) {
      submitting.current = false;
      notify.error(`${e.message} Your answers are kept on this device; try Submit again.`);
    }
  }, [answers, test.id, test.title, onDone]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(save, 20_000); return () => clearInterval(t); }, [save]);
  useEffect(() => { if (left === 0) submit("time"); }, [left, submit]);

  const choose = useCallback((i) => {
    setAnswers((a) => {
      const next = { ...a, [q.key]: i };
      persist(next);
      dirty.current = true;
      return next;
    });
  }, [q?.key, persist]);
  const go = (i) => setCurrent(Math.max(0, Math.min(questions.length - 1, i)));
  const toggleFlag = () => setFlags((f) => {
    const next = new Set(f);
    if (next.has(q.key)) next.delete(q.key);
    else next.add(q.key);
    return next;
  });

  async function askSubmit() {
    const blank = questions.length - answeredCount;
    const ok = await appConfirm(blank ? `${blank} question${blank === 1 ? " is" : "s are"} still unanswered. You can't change answers after submitting.` : "You can't change answers after submitting.", { title: "Submit your test?", confirmLabel: "Submit" });
    if (ok) submit("manual");
  }
  async function leave() {
    await save();
    const ok = await appConfirm("The clock keeps running while you're away. Your answers so far are saved.", { title: "Leave the test?", confirmLabel: "Leave" });
    if (ok) navigate("/dashboard/tests");
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea") || calc) return;
      const k = e.key.toLowerCase();
      if (k in LETTER_KEYS && LETTER_KEYS[k] < (q?.o?.length || 0)) choose(LETTER_KEYS[k]);
      else if (k === "n" || e.key === "ArrowRight") go(current + 1);
      else if (k === "p" || e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const name = profile?.name || "Candidate";
  const Palette = (
    <div className="utme-palette">
      <div className="utme-palette-head">
        <p className="font-semibold">{section?.name}</p>
        <p className="num text-xs opacity-75">{secQs.filter(({ qq }) => answers[qq.key] != null && answers[qq.key] !== -1).length}/{secQs.length} answered</p>
      </div>
      <div className="utme-grid">
        {secQs.map(({ qq, i }, n) => (
          <button key={qq.key} type="button" onClick={() => { go(i); setPalette(false); }} className={`utme-cell num ${answers[qq.key] != null && answers[qq.key] !== -1 ? "is-done" : ""} ${i === current ? "is-current" : ""} ${flags.has(qq.key) ? "is-flag" : ""}`} aria-label={`Question ${n + 1}`}>{n + 1}</button>
        ))}
      </div>
      <div className="utme-legend"><span><i className="is-done" /> Answered</span><span><i /> Not yet</span><span><i className="is-flag" /> Flagged</span></div>
    </div>
  );

  return (
    <div className="utme-room">
      <header className="utme-top">
        <div className="utme-top-in">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/mark-full-color.png" alt="" className="h-8 w-8 rounded-[3px] bg-white p-0.5" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-logo text-[0.98rem] font-bold">{test.title}</p>
              <p className="whitespace-nowrap text-xs text-white/60">General test{saving ? " · saving…" : ""}</p>
            </div>
          </div>
          <div className="utme-candidate">
            {profile?.photoUrl ? <img src={profile.photoUrl} alt="" /> : <span>{name.slice(0, 1)}</span>}
            <div className="min-w-0 leading-tight"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-white/60">Candidate</p></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`utme-timer ${low ? "is-low" : ""}`}><Timer size={16} /><span className="num">{formatClock(left)}</span><span className="hidden text-[0.7rem] font-medium opacity-70 sm:inline">left</span></div>
            <button type="button" onClick={() => setCalc((v) => !v)} className={`utme-topbtn ${calc ? "is-on" : ""}`} aria-pressed={calc}><Calculator size={16} /><span className="hidden md:inline">Calculator</span></button>
            <button type="button" onClick={leave} className="utme-topbtn" aria-label="Leave test"><LogOut size={16} /></button>
          </div>
        </div>
        {sections.length > 1 && (
          <nav className="utme-tabs" aria-label="Sections">
            {sections.map((s) => {
              const first = questions.findIndex((qq) => qq.section === s.key);
              const total = questions.filter((qq) => qq.section === s.key).length;
              const done = questions.filter((qq) => qq.section === s.key && answers[qq.key] != null && answers[qq.key] !== -1).length;
              if (!total) return null;
              return <button key={s.key} type="button" onClick={() => go(s.key === q.section ? current : first)} className={s.key === q.section ? "is-on" : ""}>{s.name} <span className="num">{done}/{total}</span></button>;
            })}
          </nav>
        )}
      </header>

      <main className="utme-main">
        <section className="utme-sheet">
          {current === 0 && test.instructions && <p className="ctl-note mb-4 whitespace-pre-wrap">{test.instructions}</p>}
          <div className="utme-sheet-head">
            <p><span className="font-semibold text-text-primary">Question <span className="num">{pos}</span></span> <span className="text-text-muted">of <span className="num">{secQs.length}</span></span></p>
            <span className="utme-yearchip">{section?.name}{q.y ? ` · ${q.y}` : ""}</span>
            <button type="button" onClick={toggleFlag} className={`utme-flag ${flags.has(q.key) ? "is-on" : ""}`}><Flag size={14} /> {flags.has(q.key) ? "Flagged" : "Flag"}</button>
          </div>
          <UtmeQuestion q={q} number={pos} selected={answers[q.key] === -1 ? undefined : answers[q.key]} onSelect={choose} passage={q.passage} />
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
            <button type="button" onClick={askSubmit} className="utme-submit"><Send size={16} /> Submit test</button>
            <p className="mt-3 text-xs leading-relaxed text-text-muted">Answers save automatically. A–E answer · N next · P previous</p>
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

function TestResult({ result }) {
  const [filter, setFilter] = useState("wrong");
  const review = result.review || [];
  const list = review.filter((q) => (filter === "all" ? true : filter === "wrong" ? q.chosen != null && q.chosen !== -1 && q.chosen !== q.a : filter === "skipped" ? q.chosen == null || q.chosen === -1 : q.chosen === q.a));
  return (
    <div className="utme-room">
      <header className="utme-top"><div className="utme-top-in">
        <p className="font-logo text-[0.98rem] font-bold">{result.title || "Test"}</p>
        <Link to="/dashboard/tests" className="utme-topbtn ml-auto"><LogOut size={16} /><span className="hidden sm:inline">Done</span></Link>
      </div></header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {!result.visible ? (
          <div className="ctl-panel text-center"><CheckCircle2 className="mx-auto text-[#0a9a78]" size={28} /><p className="mt-2 font-semibold text-text-primary">Submitted</p><p className="text-sm text-text-secondary">{result.message}</p></div>
        ) : (
          <>
            <div className="prog-strip">
              <div><dt>Score</dt><dd className="num text-[1.6rem]">{result.score}%</dd></div>
              <div><dt>Correct</dt><dd className="num">{result.correct} / {result.total}</dd></div>
              {(result.sectionScores || []).filter((s) => s.total).map((s) => <div key={s.key}><dt>{s.name}</dt><dd className="num">{s.correct}/{s.total}</dd></div>)}
            </div>
            <section className="ctl-panel !p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3">
                <h2 className="mr-auto font-semibold text-text-primary">Review</h2>
                <div className="utme-filter">{[["wrong", "Wrong"], ["skipped", "Skipped"], ["right", "Right"], ["all", "All"]].map(([k, l]) => <button key={k} type="button" className={filter === k ? "is-on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
              </div>
              <div className="divide-y divide-border-subtle">
                {!list.length && <p className="px-5 py-8 text-center text-sm text-text-secondary">Nothing here.</p>}
                {list.map((q) => (
                  <div key={q.key} className="px-4 py-5 sm:px-6">
                    <UtmeQuestion q={q} number={review.indexOf(q) + 1} selected={q.chosen === -1 ? undefined : q.chosen} reveal passage={q.passage} />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
