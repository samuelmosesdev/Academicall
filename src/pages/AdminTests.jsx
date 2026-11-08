/**
 * Admin / Agent → Tests. Set timed tests for chosen students or aspirants:
 * one subject, several, or a mix of UTME bank questions and your own.
 *
 *   list    → every test with its audience, status and results so far
 *   editor  → details, sections + questions, audience, timing, results policy
 *   results → ranking, section scores, per-question analysis, CSV
 */
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Eye, Loader2, Pencil, Plus, Send, Shuffle, Trash2, X, Lock, BarChart3, ArrowLeft } from "lucide-react";
import { PageHeader } from "../components/ui";
import { testsApi, fmtDateTime } from "../lib/gapsApi";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";
import { imgUrl, loadIndex, loadSubject, pickQuestions } from "../lib/utmeBank";
import UtmeQuestion from "../components/utme/UtmeQuestion";
import TestAudience, { EMPTY_AUDIENCE, cleanAudience } from "../components/tests/TestAudience";

const STATUS = { draft: "Draft", published: "Published", closed: "Closed", archived: "Archived" };
const uid = () => Math.random().toString(36).slice(2, 9);
const abs = (u) => new URL(u, window.location.origin).href;
const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(new Date(d).getTime() + 3600_000); // Lagos is UTC+1, no DST
  return x.toISOString().slice(0, 16);
};
const fromLocalInput = (s) => (s ? new Date(`${s}:00+01:00`).toISOString() : null);

function bankToTest(subject, q, section) {
  const pic = (p) => (p ? [abs(imgUrl(subject.slug, p[0])), p[1], p[2]] : null);
  return {
    key: `${subject.slug}:${q.id}`,
    section, slug: subject.slug, qid: String(q.id),
    s: q.s || "", si: pic(q.si), o: q.o, oi: q.oi ? q.oi.map(pic) : null, a: q.a, e: q.e || null,
    y: q.y || null, topic: subject.topics?.[q.t] || null,
    passage: q.p != null && subject.passages?.[q.p] ? subject.passages[q.p] : null,
    block: q.block || null, img: q.img || null,
  };
}

const blankTest = () => ({
  title: "", instructions: "", sections: [{ key: "s1", name: "Section 1", subject: "" }], questions: [],
  durationMin: 30, opensAt: null, closesAt: null, audience: { ...EMPTY_AUDIENCE, roles: ["aspirant"] },
  showResults: "instant", shuffle: true, maxAttempts: 1,
});

export default function AdminTests() {
  const [view, setView] = useState({ name: "list" });
  if (view.name === "edit") return <Editor id={view.id} onClose={() => setView({ name: "list" })} onResults={(id) => setView({ name: "results", id })} />;
  if (view.name === "results") return <Results id={view.id} onBack={() => setView({ name: "list" })} onEdit={(id) => setView({ name: "edit", id })} />;
  return <List onNew={() => setView({ name: "edit" })} onEdit={(id) => setView({ name: "edit", id })} onResults={(id) => setView({ name: "results", id })} />;
}

// ── list ────────────────────────────────────────────────────────────────────
function List({ onNew, onEdit, onResults }) {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState("");
  const load = () => testsApi.list(status || undefined).then((r) => setItems(r.items)).catch((e) => notify.error(e.message));
  useEffect(() => { setItems(null); load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function duplicate(t) { await testsApi.duplicate(t.id).then(load).catch((e) => notify.error(e.message)); }
  async function remove(t) {
    if (!(await appConfirm(t.status === "draft" ? "This draft will be deleted." : "This test will be archived. Results are kept.", { title: `Remove “${t.title}”?`, confirmLabel: "Remove", tone: "danger" }))) return;
    await testsApi.remove(t.id).then(load).catch((e) => notify.error(e.message));
  }

  return (
    <div className="ctl space-y-5">
      <PageHeader title="Tests" description="Set timed tests for chosen students or aspirants: one subject, several, or your own questions. Academicall marks them and ranks the results." actions={<button type="button" className="ctl-btn" onClick={onNew}><Plus size={14} /> New test</button>} />
      <div className="ctl-tabs">
        {[["", "Active"], ["draft", "Drafts"], ["published", "Published"], ["closed", "Closed"], ["archived", "Archived"]].map(([k, l]) => <button type="button" key={k} className={status === k ? "is-on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      {!items ? <p className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p> : !items.length ? (
        <div className="ctl-panel text-sm text-text-secondary">No tests here yet.</div>
      ) : (
        <div className="ctl-panel !p-0 overflow-x-auto">
          <table className="ctl-table min-w-[820px]">
            <thead><tr><th>Test</th><th className="w-56">For</th><th className="w-40">Window</th><th className="w-28">Taken</th><th className="w-24">Average</th><th className="w-36" /></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="ctl-qcell font-semibold" onClick={() => onEdit(t.id)}>{t.title}</button>
                    <span className="text-xs text-text-muted"><span className={`ctl-status ${t.status === "published" ? (t.open ? "is-added" : "is-edited") : t.status === "closed" ? "is-removed" : ""}`}>{t.status === "published" && t.open ? "Open" : STATUS[t.status]}</span> · {t.questionCount} q · {t.durationMin} min</span>
                  </td>
                  <td title={t.audienceLabel}>{t.audienceLabel}<span className="block text-xs text-text-muted num">{t.audienceCount} people</span></td>
                  <td className="text-xs">{t.opensAt ? fmtDateTime(t.opensAt) : "On publish"}<span className="block text-text-muted">{t.closesAt ? `to ${fmtDateTime(t.closesAt)}` : "no closing time"}</span></td>
                  <td className="num">{t.submitted}{t.inProgress ? <span className="block text-xs text-text-muted">{t.inProgress} sitting</span> : null}</td>
                  <td className="num">{t.averageScore != null ? `${t.averageScore}%` : "—"}</td>
                  <td>
                    <span className="flex justify-end gap-1.5">
                      <button type="button" className="ctl-icon" title="Results" onClick={() => onResults(t.id)}><BarChart3 size={14} /></button>
                      <button type="button" className="ctl-icon" title="Duplicate" onClick={() => duplicate(t)}><Copy size={14} /></button>
                      <button type="button" className="ctl-icon is-danger" title="Remove" onClick={() => remove(t)}><Trash2 size={14} /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── editor ──────────────────────────────────────────────────────────────────
function Editor({ id, onClose, onResults }) {
  const [t, setT] = useState(id ? null : blankTest());
  const [meta, setMeta] = useState({ status: "draft", id: null, locked: false });
  const [labels, setLabels] = useState({});
  const [index, setIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => { loadIndex().then(setIndex).catch(() => setIndex({ subjects: [] })); }, []);
  useEffect(() => {
    if (!id) return;
    testsApi.get(id).then(async ({ test }) => {
      const { status, ...rest } = test;
      setT({ ...blankTest(), ...rest, audience: { ...EMPTY_AUDIENCE, ...(test.audience || {}) } });
      const res = await testsApi.results(id).catch(() => null);
      setMeta({ status, id: test.id, locked: !!res && (res.summary.submitted + res.summary.inProgress) > 0 });
    }).catch((e) => notify.error(e.message));
  }, [id]);

  if (!t) return <p className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p>;
  const set = (patch) => setT((x) => ({ ...x, ...patch }));
  const bySection = (k) => t.questions.filter((q) => q.section === k);

  function body() {
    return {
      title: t.title.trim(), instructions: t.instructions?.trim() || null,
      sections: t.sections.map(({ key, name, subject }) => ({ key, name: name.trim() || "Section", subject: subject || null })),
      questions: t.questions, durationMin: Number(t.durationMin) || 30,
      opensAt: t.opensAt || null, closesAt: t.closesAt || null, audience: cleanAudience(t.audience),
      showResults: t.showResults, shuffle: !!t.shuffle, maxAttempts: Number(t.maxAttempts) || 1,
    };
  }
  async function save({ quiet } = {}) {
    if (t.title.trim().length < 3) { notify.error("Give the test a title."); return null; }
    setSaving(true);
    try {
      const r = meta.id ? await testsApi.update(meta.id, body()) : await testsApi.create(body());
      setMeta((m) => ({ ...m, id: r.test.id, status: r.test.status }));
      if (!quiet) notify.success("Saved");
      return r.test;
    } catch (e) { notify.error(e.message); return null; } finally { setSaving(false); }
  }
  async function publish() {
    if (!t.questions.length) return notify.error("Add questions first.");
    const saved = await save({ quiet: true });
    if (!saved) return;
    const ok = await appConfirm(`Everyone in the audience gets a notification${t.opensAt ? " and the test opens at the time you set" : " and can start straight away"}. You can still change the timing and audience later.`, { title: `Publish “${t.title}”?`, confirmLabel: "Publish and notify" });
    if (!ok) return;
    try {
      const r = await testsApi.publish(saved.id);
      setMeta((m) => ({ ...m, status: "published" }));
      notify.success(`Published. ${r.notified} people notified.`);
    } catch (e) { notify.error(e.message); }
  }
  async function closeNow() {
    if (!(await appConfirm("Anyone still sitting it is submitted with the answers they've saved.", { title: "Close the test now?", confirmLabel: "Close test", tone: "danger" }))) return;
    await testsApi.close(meta.id).then(() => { setMeta((m) => ({ ...m, status: "closed" })); notify.success("Closed"); }).catch((e) => notify.error(e.message));
  }
  async function reopen() {
    const s = await appPrompt("New closing time (Lagos), as YYYY-MM-DD HH:MM. Leave empty for no closing time.", { title: "Reopen the test", multiline: false, placeholder: "2026-10-25 18:00" });
    if (s === null) return;
    const iso = s.trim() ? fromLocalInput(s.trim().replace(" ", "T")) : null;
    await testsApi.reopen(meta.id, iso).then(() => { setMeta((m) => ({ ...m, status: "published" })); set({ closesAt: iso }); notify.success("Reopened"); }).catch((e) => notify.error(e.message));
  }

  const updateSection = (k, patch) => set({ sections: t.sections.map((s) => (s.key === k ? { ...s, ...patch } : s)) });
  const removeSection = (k) => set({ sections: t.sections.filter((s) => s.key !== k), questions: t.questions.filter((q) => q.section !== k) });
  const addQuestions = (k, qs) => {
    const have = new Set(t.questions.map((q) => q.key));
    const fresh = qs.filter((q) => !have.has(q.key));
    set({ questions: [...t.questions, ...fresh] });
    return fresh.length;
  };

  return (
    <div className="ctl space-y-5">
      <button type="button" className="ctl-btn is-ghost" onClick={onClose}><ArrowLeft size={14} /> All tests</button>
      <PageHeader
        title={meta.id ? t.title || "Untitled test" : "New test"}
        description={`${STATUS[meta.status]} · ${t.questions.length} questions`}
        actions={
          <>
            {meta.id && <button type="button" className="ctl-btn is-ghost" onClick={() => onResults(meta.id)}><BarChart3 size={14} /> Results</button>}
            <button type="button" className="ctl-btn is-ghost" onClick={() => save()} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
            {meta.status === "draft" && <button type="button" className="ctl-btn" onClick={publish}><Send size={14} /> Publish</button>}
            {meta.status === "published" && <button type="button" className="ctl-btn is-ghost" onClick={closeNow}><Lock size={14} /> Close now</button>}
            {meta.status === "closed" && <button type="button" className="ctl-btn is-ghost" onClick={reopen}>Reopen</button>}
          </>
        }
      />
      {meta.locked && <p className="ctl-note">People have started this test, so its questions are locked. Timing, audience and settings can still change.</p>}

      <section className="ctl-panel grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm"><span className="mb-1 block font-medium text-text-primary">Title</span>
          <input className="ctl-input" value={t.title} maxLength={140} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Saturday UTME mock: Biology, Chemistry, Physics" /></label>
        <label className="sm:col-span-2 text-sm"><span className="mb-1 block font-medium text-text-primary">Instructions <span className="font-normal text-text-muted">(shown before question 1)</span></span>
          <textarea className="ctl-input" rows={2} value={t.instructions || ""} onChange={(e) => set({ instructions: e.target.value })} placeholder="Answer every question. No negative marking." /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Time allowed (minutes)</span>
          <input type="number" min="1" max="360" className="ctl-input num" value={t.durationMin} onChange={(e) => set({ durationMin: e.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Attempts each</span>
          <input type="number" min="1" max="10" className="ctl-input num" value={t.maxAttempts} onChange={(e) => set({ maxAttempts: e.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Opens (Lagos time)</span>
          <input type="datetime-local" className="ctl-input" value={toLocalInput(t.opensAt)} onChange={(e) => set({ opensAt: fromLocalInput(e.target.value) })} />
          <span className="text-xs text-text-muted">Empty = opens when you publish</span></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Closes (Lagos time)</span>
          <input type="datetime-local" className="ctl-input" value={toLocalInput(t.closesAt)} onChange={(e) => set({ closesAt: fromLocalInput(e.target.value) })} />
          <span className="text-xs text-text-muted">Empty = stays open until you close it</span></label>
        <div className="text-sm"><span className="mb-1 block font-medium text-text-primary">Show results</span>
          <div className="utme-filter">
            {[["instant", "Straight away"], ["after_close", "After it closes"], ["hidden", "Staff only"]].map(([k, l]) => <button type="button" key={k} className={t.showResults === k ? "is-on" : ""} onClick={() => set({ showResults: k })}>{l}</button>)}
          </div></div>
        <label className="flex items-center gap-2 text-sm text-text-secondary self-end"><input type="checkbox" checked={!!t.shuffle} onChange={(e) => set({ shuffle: e.target.checked })} /> Shuffle questions for each candidate (sections stay in order)</label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Sections and questions</h2>
          {!meta.locked && <button type="button" className="ctl-btn is-ghost" onClick={() => set({ sections: [...t.sections, { key: `s${uid()}`, name: `Section ${t.sections.length + 1}`, subject: "" }] })}><Plus size={14} /> Add section</button>}
        </div>
        {t.sections.map((s) => (
          <SectionEditor
            key={s.key} section={s} questions={bySection(s.key)} index={index} locked={meta.locked}
            onChange={(patch) => updateSection(s.key, patch)}
            onRemove={t.sections.length > 1 ? () => removeSection(s.key) : null}
            onAdd={(qs) => addQuestions(s.key, qs)}
            onRemoveQuestion={(key) => set({ questions: t.questions.filter((q) => q.key !== key) })}
            onPreview={setPreview}
          />
        ))}
      </section>

      <section className="ctl-panel">
        <h2 className="mb-3 font-semibold text-text-primary">Who it's for</h2>
        <TestAudience value={t.audience} onChange={(audience) => set({ audience })} labels={labels} setLabels={setLabels} />
      </section>

      {preview && (
        <div className="sheet-backdrop" onClick={() => setPreview(null)}>
          <div className="sheet !max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-between"><p className="text-xs text-text-muted">{preview.topic}{preview.y ? ` · ${preview.y}` : ""}</p><button type="button" className="ctl-icon" onClick={() => setPreview(null)}><X size={14} /></button></div>
            <UtmeQuestion q={preview} number={1} selected={preview.a} reveal passage={preview.passage} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionEditor({ section, questions, index, locked, onChange, onRemove, onAdd, onRemoveQuestion, onPreview }) {
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [year, setYear] = useState("");
  const [count, setCount] = useState(20);
  const [writing, setWriting] = useState(false);
  const slug = section.subject;

  useEffect(() => {
    setSubject(null); setTopics([]); setYear("");
    if (slug) loadSubject(slug).then(setSubject).catch((e) => notify.error(e.message));
  }, [slug]);

  function addRandom() {
    if (!subject) return;
    const picked = pickQuestions(subject, { mode: year ? "year" : topics.length ? "topic" : "mixed", topics, year: year || undefined, count: Number(count) * 3 });
    const have = new Set(questions.map((q) => q.key));
    const fresh = picked.filter((q) => !have.has(`${subject.slug}:${q.id}`)).slice(0, Number(count));
    const n = onAdd(fresh.map((q) => bankToTest(subject, q, section.key)));
    notify.success(n ? `Added ${n} question${n === 1 ? "" : "s"}` : "No new questions match. Change the topics or year.");
  }

  return (
    <div className="ctl-panel space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Section name</span>
          <input className="ctl-input !w-56" value={section.name} onChange={(e) => onChange({ name: e.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">UTME subject <span className="font-normal text-text-muted">(optional)</span></span>
          <select className="ctl-input !w-60" value={slug || ""} onChange={(e) => onChange({ subject: e.target.value, ...(e.target.value && /^Section \d+$/.test(section.name) ? { name: index?.subjects.find((x) => x.slug === e.target.value)?.name || section.name } : {}) })} disabled={locked}>
            <option value="">None: my own questions</option>
            {(index?.subjects || []).map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select></label>
        <span className="ml-auto text-sm text-text-secondary"><b className="num text-text-primary">{questions.length}</b> questions</span>
        {onRemove && !locked && <button type="button" className="ctl-icon is-danger" onClick={onRemove} aria-label="Remove section"><Trash2 size={14} /></button>}
      </div>

      {!locked && slug && (
        <div className="aud-box">
          {!subject ? <p className="text-sm text-text-muted"><Loader2 size={13} className="mr-1 inline animate-spin" /> Loading {slug}…</p> : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm"><span className="mb-1 block text-text-secondary">Topics</span>
                <select multiple className="ctl-input !h-28 !w-72" value={topics.map(String)} onChange={(e) => setTopics([...e.target.selectedOptions].map((o) => Number(o.value)))}>
                  {subject.topics.map((tp, i) => <option key={i} value={i}>{tp}</option>)}
                </select>
                <span className="block text-xs text-text-muted">None picked = all topics</span></label>
              <label className="text-sm"><span className="mb-1 block text-text-secondary">Year</span>
                <select className="ctl-input !w-32" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">Any</option>{[...(subject.years || [])].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
                </select></label>
              <label className="text-sm"><span className="mb-1 block text-text-secondary">How many</span>
                <input type="number" min="1" max="200" className="ctl-input !w-24 num" value={count} onChange={(e) => setCount(e.target.value)} /></label>
              <button type="button" className="ctl-btn" onClick={addRandom}><Shuffle size={14} /> Add random questions</button>
            </div>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <ol className="tq-list">
          {questions.map((q, i) => (
            <li key={q.key}>
              <span className="num text-text-muted">{i + 1}.</span>
              <button type="button" className="ctl-qcell" onClick={() => onPreview(q)}>{(q.s || "(picture question)").replace(/\*\*/g, "")}</button>
              <span className="shrink-0 text-xs text-text-muted">{q.slug ? `${q.topic || ""}${q.y ? ` · ${q.y}` : ""}` : "Own"}</span>
              <button type="button" className="ctl-icon" onClick={() => onPreview(q)} aria-label="Preview"><Eye size={13} /></button>
              {!locked && <button type="button" className="ctl-icon is-danger" onClick={() => onRemoveQuestion(q.key)} aria-label="Remove question"><X size={13} /></button>}
            </li>
          ))}
        </ol>
      )}

      {!locked && (writing
        ? <OwnQuestion section={section.key} onCancel={() => setWriting(false)} onSave={(q) => { onAdd([q]); setWriting(false); }} />
        : <button type="button" className="ctl-btn is-ghost" onClick={() => setWriting(true)}><Pencil size={14} /> Write a question</button>)}
    </div>
  );
}

function OwnQuestion({ section, onSave, onCancel }) {
  const [s, setS] = useState("");
  const [o, setO] = useState(["", "", "", ""]);
  const [a, setA] = useState(0);
  const [e, setE] = useState("");
  const ok = s.trim() && o.filter((x) => x.trim()).length >= 2 && o[a]?.trim();
  return (
    <div className="aud-box space-y-2">
      <textarea className="ctl-input" rows={3} value={s} onChange={(ev) => setS(ev.target.value)} placeholder="Question (use **bold** for emphasis)" />
      {o.map((txt, i) => (
        <div key={i} className={`ctl-optrow ${a === i ? "is-answer" : ""}`}>
          <label className="ctl-optpick" title="Mark as the answer"><input type="radio" checked={a === i} onChange={() => setA(i)} />{"ABCDE"[i]}</label>
          <input className="ctl-input" value={txt} onChange={(ev) => setO(o.map((x, j) => (j === i ? ev.target.value : x)))} placeholder={`Option ${"ABCDE"[i]}`} />
          {o.length > 2 && <button type="button" className="ctl-icon" onClick={() => { setO(o.filter((_, j) => j !== i)); if (a >= i && a > 0) setA(a - 1); }} aria-label="Remove option"><X size={13} /></button>}
        </div>
      ))}
      {o.length < 5 && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => setO([...o, ""])}><Plus size={13} /> Option</button>}
      <textarea className="ctl-input" rows={2} value={e} onChange={(ev) => setE(ev.target.value)} placeholder="Explanation shown in review (optional)" />
      <div className="flex justify-end gap-2">
        <button type="button" className="ctl-btn is-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="ctl-btn" disabled={!ok} onClick={() => {
          const keep = o.map((x, i) => ({ x: x.trim(), i })).filter((y) => y.x);
          onSave({ key: `own:${uid()}`, section, s: s.trim(), o: keep.map((y) => y.x), a: keep.findIndex((y) => y.i === a), e: e.trim() || null, topic: null });
        }}>Add question</button>
      </div>
    </div>
  );
}

// ── results ─────────────────────────────────────────────────────────────────
function Results({ id, onBack, onEdit }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { testsApi.results(id).then(setData).catch((e) => notify.error(e.message)); }, [id]);
  const rows = useMemo(() => (data?.items || []).filter((r) => !q || `${r.user.name} ${r.user.email} ${r.user.uniqueId}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  if (!data) return <p className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading results…</p>;
  const s = data.summary;
  const sections = (data.test.sections || []).map((x) => x.name);
  const hardest = [...data.questions].filter((x) => x.of).sort((a, b) => a.right / a.of - b.right / b.of).slice(0, 8);

  return (
    <div className="ctl space-y-5">
      <button type="button" className="ctl-btn is-ghost" onClick={onBack}><ArrowLeft size={14} /> All tests</button>
      <PageHeader title={data.test.title} description="Results" actions={<>
        <button type="button" className="ctl-btn is-ghost" onClick={() => onEdit(id)}><Pencil size={14} /> Edit test</button>
        <button type="button" className="ctl-btn" onClick={() => testsApi.resultsCsv(id).catch((e) => notify.error(e.message))}><Download size={14} /> Download CSV</button>
      </>} />
      <div className="prog-strip">
        <div><dt>Submitted</dt><dd className="num">{s.submitted}</dd></div>
        <div><dt>Sitting now</dt><dd className="num">{s.inProgress}</dd></div>
        <div><dt>Not started</dt><dd className="num">{s.notStarted}</dd></div>
        <div><dt>Average</dt><dd className="num">{s.average != null ? `${s.average}%` : "—"}</dd></div>
        <div><dt>Highest</dt><dd className="num">{s.highest != null ? `${s.highest}%` : "—"}</dd></div>
      </div>

      <section className="ctl-panel !p-0 overflow-x-auto">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <h2 className="mr-auto text-sm font-semibold text-text-muted">Candidates</h2>
          <div className="ctl-search !w-64"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a candidate" /></div>
        </div>
        {!rows.length ? <p className="px-4 py-5 text-sm text-text-secondary">Nobody has taken it yet.</p> : (
          <table className="ctl-table min-w-[760px]">
            <thead><tr><th className="w-14">#</th><th>Name</th><th className="w-40">Where</th><th className="w-20">Score</th>{sections.length > 1 && sections.map((n) => <th key={n} className="w-24" title={n}>{n}</th>)}<th className="w-20">Minutes</th><th className="w-36">Submitted</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.rank ?? "—"}</td>
                  <td>{r.user.name || r.user.email}<span className="block text-xs text-text-muted">{r.user.role === "aspirant" ? "Aspirant" : "Student"}{r.user.uniqueId ? ` · ${r.user.uniqueId}` : ""}</span></td>
                  <td className="text-xs">{[r.user.institution, r.user.level && `${r.user.level}L`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="num font-semibold">{r.status === "submitted" ? `${r.score}%` : "Sitting"}</td>
                  {sections.length > 1 && sections.map((n) => { const x = (r.sectionScores || []).find((y) => y.name === n); return <td key={n} className="num">{x ? `${x.correct}/${x.total}` : "—"}</td>; })}
                  <td className="num">{r.durationSec != null ? Math.round(r.durationSec / 60) : "—"}</td>
                  <td className="text-xs">{fmtDateTime(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {hardest.length > 0 && (
        <section className="ctl-panel !p-0">
          <h2 className="ctl-panel-title">Hardest questions</h2>
          <table className="ctl-table">
            <thead><tr><th className="w-14">Q</th><th>Question</th><th className="w-28">Got it right</th></tr></thead>
            <tbody>{hardest.map((x) => <tr key={x.key}><td className="num">{x.n}</td><td title={x.stem}>{(x.stem || "(picture)").replace(/\*\*/g, "")}</td><td className="num">{x.right}/{x.of} ({Math.round((x.right / x.of) * 100)}%)</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
