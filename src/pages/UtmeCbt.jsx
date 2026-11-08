import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpenCheck, CalendarRange, Shuffle, Timer, Lightbulb, Lock, Check, ChevronDown, Play, History, Trash2, Calculator, Layers, BookMarked,
} from "lucide-react";
import { PageHeader } from "../components/ui";
import UtmeProgress from "../components/utme/UtmeProgress";
import { Skel as Skeleton } from "../components/ui";
import { appConfirm, notify } from "../lib/dialogs";
import {
  ENGLISH, JAMB_COUNT, JAMB_SECONDS_PER_QUESTION, loadIndex, loadSubject, pickQuestions, liveSession, utmeApi, formatClock,
} from "../lib/utmeBank";

const MODES = [
  { id: "topic", label: "By topic", hint: "Drill the syllabus one topic at a time", icon: BookOpenCheck },
  { id: "year", label: "By year", hint: "Sit a past paper, 1978 to 2026", icon: CalendarRange },
  { id: "mixed", label: "Mixed", hint: "Random questions from every year", icon: Shuffle },
];

function Seg({ value, onChange, options }) {
  return (
    <div className="utme-seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={value === o.id ? "is-on" : ""}>
          {o.icon && <o.icon size={17} />}
          <span className="text-left">
            <span className="block font-semibold">{o.label}</span>
            {o.hint && <span className="block text-xs opacity-75">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Step({ n, title, children, aside }) {
  return (
    <section className="utme-step">
      <div className="utme-step-head">
        <span className="utme-step-n num">{n}.</span>
        <h2>{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export default function UtmeCbt() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(null);
  const [err, setErr] = useState("");
  const [scope, setScope] = useState("single"); // single | full
  const [single, setSingle] = useState(() => new URLSearchParams(window.location.search).get("subject") || ENGLISH);
  const [others, setOthers] = useState([]); // three subjects beside English
  const [mode, setMode] = useState("topic");
  const [topics, setTopics] = useState({}); // slug -> [topicIdx]
  const [years, setYears] = useState({}); // slug -> year
  const [countMode, setCountMode] = useState("forty"); // forty | jamb
  const [style, setStyle] = useState("exam"); // exam | practice
  const [subjects, setSubjects] = useState({}); // slug -> loaded subject (for topics)
  const [openTopics, setOpenTopics] = useState(null);
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState(null);
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get("tab") === "progress" ? "progress" : "practice"));

  /** From Progress: set up a topic drill on one weak topic. */
  async function drill(slug, topicName) {
    try {
      const subj = await loadSubject(slug);
      const i = subj.topics.indexOf(topicName);
      setSubjects((m) => ({ ...m, [slug]: subj }));
      setScope("single");
      setSingle(slug);
      setMode("topic");
      setStyle("practice");
      setTopics((m) => ({ ...m, [slug]: i >= 0 ? [i] : [] }));
      setTab("practice");
      window.scrollTo({ top: 0 });
      notify.success(`Ready: ${topicName}. Press Start when you're set.`);
    } catch (e) { notify.error(e.message); }
  }

  useEffect(() => {
    loadIndex().then(setIndex).catch((e) => setErr(e.message));
    utmeApi.list().then(setHistory);
  }, []);

  const resume = liveSession.get();
  const chosen = scope === "single" ? [single] : [ENGLISH, ...others];
  const meta = useMemo(() => Object.fromEntries((index?.subjects || []).map((s) => [s.slug, s])), [index]);

  // load subject files we need to list topics
  useEffect(() => {
    if (mode !== "topic") return;
    chosen.forEach((slug) => {
      if (!subjects[slug]) loadSubject(slug).then((d) => setSubjects((m) => ({ ...m, [slug]: d }))).catch(() => {});
    });
  }, [mode, chosen.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // default year = newest year with a full-size paper
  useEffect(() => {
    if (!index) return;
    setYears((y) => {
      const next = { ...y };
      chosen.forEach((slug) => {
        if (next[slug] || !meta[slug]) return;
        // newest paper with at least 40 questions, else the newest one
        const ys = meta[slug].years.slice().reverse();
        const counts = meta[slug].yearCounts || {};
        next[slug] = ys.find((y) => (counts[y] || 0) >= 40) || ys[0];
      });
      return next;
    });
  }, [index, chosen.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const perSubjectCount = (slug) => (countMode === "jamb" ? JAMB_COUNT(slug) : 40);
  const totalQ = chosen.reduce((n, s) => n + perSubjectCount(s), 0);
  const timeLimit = style === "exam" ? Math.round(totalQ * JAMB_SECONDS_PER_QUESTION) : null;
  const ready = scope === "single" ? !!single : others.length === 3;

  function toggleOther(slug) {
    setOthers((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= 3 ? cur : [...cur, slug]));
  }
  function toggleTopic(slug, t) {
    setTopics((m) => {
      const cur = m[slug] || [];
      return { ...m, [slug]: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] };
    });
  }

  async function start() {
    if (!ready) return;
    if (resume) {
      const ok = await appConfirm("You have an unfinished CBT session. Starting a new one discards it.", { confirmLabel: "Start new" });
      if (!ok) return;
    }
    setStarting(true);
    try {
      const loaded = await Promise.all(chosen.map((slug) => loadSubject(slug)));
      const questions = [];
      const passages = {};
      const subs = [];
      for (const subj of loaded) {
        const count = perSubjectCount(subj.slug);
        const qs = pickQuestions(subj, { mode, topics: topics[subj.slug] || [], year: years[subj.slug], count, shuffleOptions: false });
        if (!qs.length) throw new Error(`No ${subj.subject} questions match that choice. Pick another topic or year.`);
        qs.forEach((q) => { if (q.p != null) passages[`${subj.slug}:${q.p}`] = subj.passages[q.p]; });
        questions.push(...qs);
        subs.push({ slug: subj.slug, name: subj.subject, rtl: subj.rtl, count: qs.length, topics: subj.topics });
      }
      const session = {
        id: `s${Date.now()}`,
        mode, style, countMode,
        subjects: subs.map(({ topics: allTopics, ...s }) => ({ ...s, topicNames: (topics[s.slug] || []).map((t) => allTopics[t]) })),
        topicNames: Object.fromEntries(subs.map((s) => [s.slug, s.topics])),
        years: mode === "year" ? Object.fromEntries(chosen.map((s) => [s, Number(years[s])])) : null,
        questions,
        passages,
        timeLimitSec: style === "exam" ? Math.round(questions.length * JAMB_SECONDS_PER_QUESTION) : null,
        startedAt: Date.now(),
        answers: {},
        flags: [],
        current: 0,
      };
      liveSession.set(session);
      navigate("/utme/exam");
    } catch (e) {
      notify.error(e.message);
    } finally {
      setStarting(false);
    }
  }

  async function removeAttempt(row) {
    const ok = await appConfirm("Delete this session from your history?", { confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await utmeApi.remove(row.id);
      setHistory((h) => ({ ...h, items: h.items.filter((r) => r.id !== row.id) }));
    } catch (e) { notify.error(e.message); }
  }

  if (err) return <div className="acx-card text-sm text-status-danger">{err}</div>;

  const pool = (index?.subjects || []).filter((s) => s.slug !== ENGLISH);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="UTME CBT"
        description="Practise the way JAMB tests you: past questions from 1978 to 2026, the CBT screen, the timer and the calculator."
      />

      <div className="ctl-tabs">
        <button type="button" className={tab === "practice" ? "is-on" : ""} onClick={() => setTab("practice")}>Practice</button>
        <button type="button" className={tab === "progress" ? "is-on" : ""} onClick={() => setTab("progress")}>Progress</button>
      </div>

      {tab === "progress" ? <UtmeProgress onDrill={drill} /> : (<>

      {resume && (
        <div className="utme-resume">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">You have a session in progress</p>
            <p className="text-sm opacity-80">{resume.subjects.map((s) => s.name).join(", ")} · {Object.keys(resume.answers || {}).length} of {resume.questions.length} answered</p>
          </div>
          <button type="button" onClick={() => navigate("/utme/exam")} className="utme-resume-btn">Continue</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Step n="1" title="What are you practising?">
            <Seg
              value={scope}
              onChange={setScope}
              options={[
                { id: "single", label: "One subject", hint: "Focus on a single subject", icon: BookMarked },
                { id: "full", label: "Full UTME", hint: "Use of English + 3 subjects", icon: Layers },
              ]}
            />
            {!index ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : scope === "single" ? (
              <div className="utme-subjects mt-4">
                {index.subjects.map((s) => (
                  <button key={s.slug} type="button" onClick={() => setSingle(s.slug)} className={`utme-subject ${single === s.slug ? "is-on" : ""}`}>
                    <span className="truncate">{s.name}</span>
                    <span className="num text-xs opacity-70">{s.count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm text-text-secondary">Use of English is compulsory. Pick the other three subjects on your JAMB registration <b className="text-text-primary">({others.length}/3)</b>.</p>
                <div className="utme-subjects mt-3">
                  <span className="utme-subject is-on is-locked"><span className="truncate">Use of English</span><Lock size={13} /></span>
                  {pool.map((s) => {
                    const on = others.includes(s.slug);
                    return (
                      <button key={s.slug} type="button" disabled={!on && others.length >= 3} onClick={() => toggleOther(s.slug)} className={`utme-subject ${on ? "is-on" : ""}`}>
                        <span className="truncate">{s.name}</span>
                        {on ? <Check size={14} /> : <span className="num text-xs opacity-70">{s.count.toLocaleString()}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Step>

          <Step n="2" title="How do you want to study?">
            <Seg value={mode} onChange={setMode} options={MODES} />
            {mode === "topic" && (
              <div className="mt-4 space-y-2">
                {chosen.map((slug) => {
                  const subj = subjects[slug];
                  const picked = topics[slug] || [];
                  const open = openTopics === slug || chosen.length === 1;
                  return (
                    <div key={slug} className="utme-topicbox">
                      <button type="button" className="utme-topicbox-head" onClick={() => setOpenTopics(open && chosen.length > 1 ? null : slug)}>
                        <span className="font-semibold">{meta[slug]?.name}</span>
                        <span className="text-sm text-text-secondary">{picked.length ? `${picked.length} topic${picked.length > 1 ? "s" : ""}` : "All topics"}</span>
                        {chosen.length > 1 && <ChevronDown size={16} className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />}
                      </button>
                      {open && (
                        <div className="utme-topics">
                          {!subj ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-full" />) : (
                            <>
                              <button type="button" onClick={() => setTopics((m) => ({ ...m, [slug]: [] }))} className={`utme-chip ${picked.length === 0 ? "is-on" : ""}`}>All topics</button>
                              {subj.topics.map((name, i) => (
                                <button key={name} type="button" onClick={() => toggleTopic(slug, i)} className={`utme-chip ${picked.includes(i) ? "is-on" : ""}`}>{name}</button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {mode === "year" && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {chosen.map((slug) => (
                  <label key={slug} className="utme-yearpick">
                    <span className="text-sm font-semibold text-text-primary">{meta[slug]?.name}</span>
                    <select className="field !py-2" value={years[slug] || ""} onChange={(e) => setYears((y) => ({ ...y, [slug]: Number(e.target.value) }))}>
                      {(meta[slug]?.years || []).slice().reverse().map((y) => <option key={y} value={y}>JAMB {y}{meta[slug]?.yearCounts?.[y] ? ` · ${meta[slug].yearCounts[y]} questions` : ""}</option>)}
                    </select>
                  </label>
                ))}
                <p className="text-xs text-text-muted sm:col-span-2">Some older papers have fewer questions than the count you pick; you get the whole paper.</p>
              </div>
            )}
          </Step>

          <Step n="3" title="How many questions?">
            <Seg
              value={countMode}
              onChange={setCountMode}
              options={[
                { id: "forty", label: "40 per subject", hint: scope === "full" ? "160 questions in all" : "40 questions" },
                { id: "jamb", label: "JAMB standard", hint: chosen.includes(ENGLISH) ? "English 60, others 40" : "40 questions, as in UTME" },
              ]}
            />
          </Step>

          <Step n="4" title="Timed CBT or practice?">
            <Seg
              value={style}
              onChange={setStyle}
              options={[
                { id: "exam", label: "Timed CBT", hint: "JAMB timing; results at the end", icon: Timer },
                { id: "practice", label: "Practice", hint: "No timer; see answers as you go", icon: Lightbulb },
              ]}
            />
          </Step>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="utme-summary">
            <p className="utme-summary-label">Your session</p>
            <p className="mt-2 font-display text-[1.65rem] leading-tight">
              {scope === "single" ? meta[single]?.name || "Pick a subject" : "Full UTME"}
            </p>
            <ul className="utme-summary-list">
              <li><span>Subjects</span><b>{scope === "single" ? 1 : `${1 + others.length} of 4`}</b></li>
              <li><span>Study by</span><b>{{ topic: "Topic", year: "Year", mixed: "Mixed" }[mode]}</b></li>
              <li><span>Questions</span><b className="num">{totalQ}{mode === "year" ? " max" : ""}</b></li>
              <li><span>Time</span><b className="num">{timeLimit ? formatClock(timeLimit) : "Untimed"}</b></li>
              <li><span>Calculator</span><b className="inline-flex items-center gap-1"><Calculator size={13} /> On screen</b></li>
            </ul>
            <button type="button" onClick={start} disabled={!ready || starting || !index} className="utme-start">
              <Play size={17} /> {starting ? "Preparing questions…" : ready ? "Start CBT" : "Pick 3 more subjects"}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-white/60">Keys during the test: A–E to answer, N next, P previous, S submit.</p>
          </div>

          <div className="acx-card mt-5">
            <div className="acx-card-head"><div><h3 className="flex items-center gap-2"><History size={15} /> Recent sessions</h3><p>{history?.stats ? `${history.stats.sessions} sessions · ${history.stats.questions.toLocaleString()} questions` : "Your scores land here"}</p></div></div>
            {!history ? <Skeleton className="h-24 rounded-xl" /> : history.items.length === 0 ? (
              <p className="text-sm text-text-secondary">No sessions yet. Your first score will show here.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {history.items.slice(0, 8).map((r) => {
                  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
                  return (
                    <li key={r.id} className="group flex items-center gap-3 py-2.5">
                      <span className={`utme-ring ${pct >= 70 ? "is-good" : pct >= 50 ? "is-mid" : "is-low"}`}><span className="num">{pct}</span></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-primary">{r.subjects.map((s) => s.name).join(", ")}</p>
                        <p className="text-xs text-text-muted">
                          <span className="num">{r.score}/{r.maxScore}</span> · {r.style === "exam" ? "Timed" : "Practice"} · {new Date(r.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <button type="button" onClick={() => removeAttempt(r)} className="text-text-muted opacity-0 transition-opacity hover:text-status-danger group-hover:opacity-100 focus:opacity-100" aria-label="Delete session"><Trash2 size={14} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
      </>)}
    </div>
  );
}
