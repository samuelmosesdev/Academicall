/**
 * UTME question bank — the control room for admins and staff with `utme.manage`.
 *
 *  Questions  browse any subject by year, topic or text; edit, remove, restore,
 *             or put a question back exactly as shipped
 *  Add        write a question (pictures, passage, explanation) with a live preview
 *  Upload     many questions at once from a CSV or JSON file
 *  Changes    every change, newest first, with who made it
 *  Team       who can manage the bank
 *
 * The shipped bank is never rewritten. Changes are stored by the API and the
 * candidate app layers them on top, so everything here can be undone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Download, FileUp, ImagePlus, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, Undo2, Upload, X,
} from "lucide-react";
import { PageHeader, Pager, Drawer, Field } from "../components/ui";
import UtmeQuestion from "../components/utme/UtmeQuestion";
import { applyPatches, loadIndex, loadSubjectRaw, resetBankCache, utmeAdminApi } from "../lib/utmeBank";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";
import { utmeCoachApi } from "../lib/gapsApi";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../lib/roles";

const LETTERS = "ABCDE";
// shipped crops are 2.4x print size; uploaded pictures are stored at their real size
const UPLOAD_SCALE = 2.4 / 1.38;
const STATUS_LABEL = { edited: "Edited", added: "Added", removed: "Removed" };

const fmtWhen = (d) => (d ? new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const plain = (s) => String(s || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** Merge shipped questions with their changes into one list of rows for the table. */
function buildRows(base, patches) {
  if (!base) return [];
  const byId = new Map(patches.map((p) => [p.qid, p]));
  const rows = base.questions.map((q) => {
    const p = byId.get(q.id);
    const data = p?.data ? { ...p.data } : null;
    return { qid: q.id, base: q, patch: p || null, status: p?.status || null, q: data ? { ...q, ...data, id: q.id } : q };
  });
  for (const p of patches) if (p.isNew && p.data) rows.push({ qid: p.qid, base: null, patch: p, status: p.status, q: { ...p.data, id: p.qid } });
  return rows;
}

const topicName = (subject, q) => (q.tn ? q.tn : subject?.topics?.[q.t] ?? "—");

export default function AdminUtmeBank() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const consoleBase = pathname.startsWith("/agent") ? "/agent" : "/admin";
  const [tab, setTab] = useState("questions");
  const [index, setIndex] = useState(null);
  const [summary, setSummary] = useState({});
  const [slug, setSlug] = useState("use-of-english");
  const [base, setBase] = useState(null);
  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", year: "", topic: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState(null); // { row } | { isNew: true }
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    loadIndex().then(setIndex).catch((e) => setError(e.message));
    utmeAdminApi.summary().then((r) => setSummary(r.subjects || {})).catch(() => {});
  }, []);

  const loadSubjectData = useCallback(async (s) => {
    setLoading(true);
    setError("");
    try {
      const [b, p] = await Promise.all([loadSubjectRaw(s), utmeAdminApi.patches(s)]);
      setBase(b);
      setPatches(p.items || []);
    } catch (e) {
      setError(e.message || "This subject couldn't load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjectData(slug); setPage(1); }, [slug, loadSubjectData]);

  const refreshAfterChange = useCallback(async () => {
    resetBankCache();
    const [p, sum] = await Promise.all([utmeAdminApi.patches(slug), utmeAdminApi.summary().catch(() => null)]);
    setPatches(p.items || []);
    if (sum) setSummary(sum.subjects || {});
  }, [slug]);

  // the subject as candidates see it (for topic names of added questions)
  const live = useMemo(() => (base ? applyPatches(base, patches) : null), [base, patches]);
  const rows = useMemo(() => buildRows(base, patches), [base, patches]);

  const topics = useMemo(() => {
    const set = new Set(base?.topics || []);
    for (const p of patches) if (p.data?.tn) set.add(p.data.tn);
    return [...set];
  }, [base, patches]);

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.status === "changed" && !r.status) return false;
      if (filters.status && filters.status !== "changed" && r.status !== filters.status) return false;
      if (filters.status === "" && r.status === "removed") { /* removed rows still listed, greyed */ }
      if (filters.year && String(r.q.y) !== filters.year) return false;
      if (filters.topic && topicName(base, r.q) !== filters.topic) return false;
      if (term) {
        const hay = `${r.qid} ${plain(r.q.s)} ${(r.q.o || []).join(" ")} ${plain(r.q.e)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, filters, base]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const subjMeta = index?.subjects?.find((s) => s.slug === slug);
  const counts = summary[slug] || { edited: 0, added: 0, removed: 0 };

  async function removeRow(r) {
    const note = await appPrompt(`Remove question ${r.qid}? Candidates stop seeing it straight away. You can restore it any time.`, { title: "Remove question", placeholder: "Reason (optional)", confirmLabel: "Remove" });
    if (note === null) return;
    try {
      await utmeAdminApi.remove(slug, r.qid, note || undefined);
      notify.success("Question removed");
      refreshAfterChange();
    } catch (e) { notify.error(e.message); }
  }
  async function restoreRow(r) {
    try {
      await utmeAdminApi.restore(slug, r.qid);
      notify.success("Question restored");
      refreshAfterChange();
    } catch (e) { notify.error(e.message); }
  }
  async function revertRow(r) {
    const ok = await appConfirm(`Put question ${r.qid} back exactly as it was shipped? Every edit to it is dropped.`, { title: "Back to original", confirmLabel: "Back to original" });
    if (!ok) return;
    try {
      await utmeAdminApi.revert(slug, r.qid);
      notify.success("Back to the original");
      refreshAfterChange();
    } catch (e) { notify.error(e.message); }
  }

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="ctl space-y-5">
      <PageHeader
        title="UTME question bank"
        description="Upload, edit, remove and restore the questions candidates practise on. Changes show in the UTME CBT within a minute, and every change can be undone."
        actions={
          <>
            <button type="button" className="ctl-btn is-ghost" onClick={() => setBulkOpen(true)}><FileUp size={15} /> Upload questions</button>
            <button type="button" className="ctl-btn" onClick={() => setEditing({ isNew: true })}><Plus size={15} /> Add question</button>
          </>
        }
      />

      <nav className="ctl-tabs" aria-label="Sections">
        {[["questions", "Questions"], ["reports", "Reports"], ["insights", "Insights"], ["changes", "Changes"], ["team", "Team"]].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      {tab === "questions" && (
        <>
          <section className="ctl-panel">
            <div className="ctl-subjectbar">
              <Field label="Subject" className="min-w-[14rem] flex-1 sm:max-w-xs">
                <select className="ctl-input" value={slug} onChange={(e) => setSlug(e.target.value)}>
                  {(index?.subjects || []).map((s) => <option key={s.slug} value={s.slug}>{s.name} ({s.count.toLocaleString()})</option>)}
                </select>
              </Field>
              <dl className="ctl-stats">
                <div><dt>Live questions</dt><dd className="num">{live ? live.questions.length.toLocaleString() : "…"}</dd></div>
                <div><dt>Edited</dt><dd className="num">{counts.edited}</dd></div>
                <div><dt>Added</dt><dd className="num">{counts.added}</dd></div>
                <div><dt>Removed</dt><dd className="num">{counts.removed}</dd></div>
              </dl>
            </div>
            <div className="ctl-filters">
              <label className="ctl-search">
                <Search size={15} />
                <input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search question, option, explanation or ID" aria-label="Search questions" />
              </label>
              <select className="ctl-input" value={filters.year} onChange={(e) => setFilter("year", e.target.value)} aria-label="Year">
                <option value="">All years</option>
                {(live?.years || []).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="ctl-input" value={filters.topic} onChange={(e) => setFilter("topic", e.target.value)} aria-label="Topic">
                <option value="">All topics</option>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="ctl-input" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status">
                <option value="">Everything</option>
                <option value="changed">Changed only</option>
                <option value="edited">Edited</option>
                <option value="added">Added</option>
                <option value="removed">Removed</option>
              </select>
            </div>
          </section>

          <section className="ctl-panel !p-0">
            {error ? (
              <p className="p-5 text-sm text-status-danger">{error}</p>
            ) : loading ? (
              <div className="flex items-center gap-2 p-5 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading {subjMeta?.name || "subject"}…</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="ctl-table">
                    <thead>
                      <tr><th className="w-20">ID</th><th className="w-16">Year</th><th className="w-48">Topic</th><th>Question</th><th className="w-24">Answer</th><th className="w-24">Status</th><th className="w-36 text-right">Actions</th></tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <tr key={r.qid} className={r.status === "removed" ? "is-removed" : ""}>
                          <td className="num text-text-muted">{r.qid}</td>
                          <td className="num">{r.q.y}</td>
                          <td className="truncate text-text-secondary" title={topicName(base, r.q)}>{topicName(base, r.q)}</td>
                          <td>
                            <button type="button" className="ctl-qcell" onClick={() => setEditing({ row: r })}>
                              {plain(r.q.s) || <span className="text-text-muted">Picture question</span>}
                              {(r.q.si || r.q.oi?.some(Boolean)) && <span className="ctl-tag">picture</span>}
                              {(r.q.p != null || r.q.pt) && <span className="ctl-tag">passage</span>}
                            </button>
                          </td>
                          <td className="num">{LETTERS[r.q.a]}</td>
                          <td>{r.status ? <span className={`ctl-status is-${r.status}`}>{STATUS_LABEL[r.status]}</span> : <span className="text-text-muted">—</span>}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button type="button" className="ctl-icon" onClick={() => setEditing({ row: r })} aria-label={`Edit ${r.qid}`} title="Edit"><Pencil size={14} /></button>
                              {r.status === "removed" ? (
                                <button type="button" className="ctl-icon" onClick={() => restoreRow(r)} aria-label={`Restore ${r.qid}`} title="Restore"><RotateCcw size={14} /></button>
                              ) : (
                                <button type="button" className="ctl-icon is-danger" onClick={() => removeRow(r)} aria-label={`Remove ${r.qid}`} title="Remove"><Trash2 size={14} /></button>
                              )}
                              {r.status && !r.qid.startsWith("x-") && (
                                <button type="button" className="ctl-icon" onClick={() => revertRow(r)} aria-label={`Back to original ${r.qid}`} title="Back to original"><Undo2 size={14} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!pageRows.length && <tr><td colSpan={7} className="p-6 text-center text-sm text-text-muted">No questions match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border-subtle px-3 py-2">
                  <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
                </div>
              </>
            )}
          </section>
        </>
      )}

      {tab === "changes" && <ChangesTab index={index} onOpen={(s) => { setSlug(s); setTab("questions"); setFilters({ q: "", year: "", topic: "", status: "changed" }); }} />}
      {tab === "team" && <TeamTab admin={isAdmin(profile)} consoleBase={consoleBase} />}
      {tab === "reports" && <ReportsTab index={index} onOpen={(s, qid) => { setSlug(s); setTab("questions"); setFilters({ q: qid, year: "", topic: "", status: "" }); setPage(1); }} />}
      {tab === "insights" && <InsightsTab index={index} onOpen={(s, qid) => { setSlug(s); setTab("questions"); setFilters({ q: qid, year: "", topic: "", status: "" }); setPage(1); }} />}

      {editing && base && (
        <QuestionEditor
          key={editing.row?.qid || "new"}
          subject={base}
          subjectName={subjMeta?.name || base.subject}
          slug={slug}
          topics={topics}
          row={editing.row || null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refreshAfterChange(); }}
        />
      )}
      {bulkOpen && (
        <BulkUpload
          slug={slug}
          subjectName={subjMeta?.name || ""}
          topics={topics}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); refreshAfterChange(); }}
        />
      )}
    </div>
  );
}

// ── editor ──────────────────────────────────────────────────────────────────

function emptyQuestion(topics) {
  return { s: "", o: ["", "", "", ""], a: 0, e: "", y: new Date().getFullYear(), tn: topics[0] || "", si: null, oi: null, pt: "", ph: "" };
}

function toForm(row, subject) {
  const q = row.q;
  return {
    s: q.s || "",
    o: [...(q.o || [])],
    a: q.a ?? 0,
    e: q.e || "",
    y: q.y || new Date().getFullYear(),
    tn: q.tn || subject.topics[q.t] || "",
    si: q.si || null,
    img: q.img ?? null,
    oi: q.oi ? [...q.oi] : null,
    p: q.p ?? null,
    pt: q.pt || "",
    ph: q.ph || "",
    block: q.block ?? null,
    k: q.k ?? null,
  };
}

/** Form → bank data the API stores. */
function toData(f, subject) {
  const o = f.o.map((x) => x.trim());
  const oi = f.oi && f.oi.some(Boolean) ? o.map((_, i) => f.oi[i] || null) : null;
  const t = subject.topics.indexOf(f.tn);
  const data = { s: f.s.trim(), o, a: Number(f.a), y: Number(f.y), e: f.e.trim() || null, si: f.si || null, oi };
  if (t >= 0) data.t = t; else data.tn = f.tn.trim();
  if (f.si && f.img != null) data.img = f.img;
  if (f.block != null) data.block = f.block;
  if (f.k != null && f.k !== Number(f.a)) data.k = f.k;
  if (f.p != null) data.p = f.p;
  else if (f.pt.trim()) { data.pt = f.pt.trim(); if (f.ph.trim()) data.ph = f.ph.trim(); }
  return data;
}

function QuestionEditor({ subject, subjectName, slug, topics, row, onClose, onSaved }) {
  const isNew = !row;
  const [f, setF] = useState(() => (row ? toForm(row, subject) : emptyQuestion(topics)));
  const [note, setNote] = useState("");
  const [newTopic, setNewTopic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const preview = useMemo(() => {
    const d = toData(f, subject);
    const q = { ...d, slug, t: 0 };
    let passage = null;
    if (f.p != null) passage = subject.passages?.[f.p] || null;
    else if (f.pt.trim()) passage = { h: f.ph, b: f.pt.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean) };
    return { q, passage };
  }, [f, subject, slug]);

  async function pickImage(target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(target);
      try {
        const up = await utmeAdminApi.upload(file, slug);
        const img = [up.path, Math.round(up.width * UPLOAD_SCALE), Math.round(up.height * UPLOAD_SCALE)];
        if (target === "stem") setF((x) => ({ ...x, si: img, img: 2 }));
        else setF((x) => { const oi = x.oi ? [...x.oi] : x.o.map(() => null); oi[target] = img; return { ...x, oi }; });
      } catch (e) { notify.error(e.message); }
      setUploading(null);
    };
    input.click();
  }

  function setOption(i, v) { setF((x) => { const o = [...x.o]; o[i] = v; return { ...x, o }; }); }
  function addOption() { setF((x) => (x.o.length >= 5 ? x : { ...x, o: [...x.o, ""], oi: x.oi ? [...x.oi, null] : null })); }
  function dropOption(i) {
    setF((x) => {
      if (x.o.length <= 2) return x;
      const o = x.o.filter((_, j) => j !== i);
      const oi = x.oi ? x.oi.filter((_, j) => j !== i) : null;
      let a = Number(x.a);
      if (a === i) a = 0; else if (a > i) a -= 1;
      return { ...x, o, oi, a };
    });
  }

  async function save() {
    setErr("");
    const data = toData(f, subject);
    if (!data.s && !data.si) return setErr("Write the question or add a picture of it.");
    if (data.o.some((o, i) => !o && !data.oi?.[i])) return setErr("Every option needs text or a picture.");
    if (!data.tn && data.t == null) return setErr("Pick a topic.");
    setSaving(true);
    try {
      if (isNew) await utmeAdminApi.add(slug, data, note || undefined);
      else await utmeAdminApi.save(slug, row.qid, data, note || undefined);
      notify.success(isNew ? "Question added" : "Changes saved");
      onSaved();
    } catch (e) {
      setErr(e.message || "That didn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      subtitle={`${subjectName}${row ? ` · ${row.qid}` : ""}`}
      title={isNew ? "Add a question" : "Edit question"}
      actions={<button type="button" className="ctl-btn" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : null} {isNew ? "Add question" : "Save"}</button>}
    >
      <div className="ctl space-y-5">
        {row?.status === "removed" && <p className="ctl-note">This question is removed. Saving keeps it removed; restore it from the list to bring it back.</p>}

        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Field label="Year">
            <input type="number" className="ctl-input" min={1978} max={2100} value={f.y} onChange={(e) => set("y", e.target.value)} />
          </Field>
          <Field label="Topic">
            {newTopic ? (
              <div className="flex gap-2">
                <input className="ctl-input" value={f.tn} onChange={(e) => set("tn", e.target.value)} placeholder="New topic name" autoFocus />
                <button type="button" className="ctl-btn is-ghost" onClick={() => { setNewTopic(false); set("tn", topics[0] || ""); }}>Cancel</button>
              </div>
            ) : (
              <select className="ctl-input" value={f.tn} onChange={(e) => (e.target.value === "__new" ? (setNewTopic(true), set("tn", "")) : set("tn", e.target.value))}>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__new">New topic…</option>
              </select>
            )}
          </Field>
        </div>

        <Field label="Question" hint="Wrap words in **double stars** to make them bold, as JAMB does for underlined words.">
          <textarea className="ctl-input min-h-[6rem]" value={f.s} onChange={(e) => set("s", e.target.value)} placeholder="Type the question" />
        </Field>

        <div>
          <span className="acx-label">Question picture</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="ctl-btn is-ghost" onClick={() => pickImage("stem")} disabled={uploading === "stem"}>
              {uploading === "stem" ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {f.si ? "Replace picture" : "Add diagram or picture"}
            </button>
            {f.si && <button type="button" className="ctl-btn is-ghost" onClick={() => setF((x) => ({ ...x, si: null, img: null }))}><X size={14} /> Remove picture</button>}
            {f.si && f.img !== 2 && <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={false} onChange={() => set("img", 2)} /> Also show the typed question above the picture</label>}
          </div>
          <p className="mt-1 text-[0.72rem] text-text-muted">PNG, JPG or WebP up to 6 MB. Pictures get the academicall.site watermark automatically.</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="acx-label !mb-0">Options and answer</span>
            {f.o.length < 5 && !f.block && <button type="button" className="text-xs font-semibold text-accent" onClick={addOption}>Add option E</button>}
          </div>
          <div className="space-y-2">
            {f.o.map((text, i) => (
              <div key={i} className={`ctl-optrow ${Number(f.a) === i ? "is-answer" : ""}`}>
                <label className="ctl-optpick" title="Correct answer">
                  <input type="radio" name="answer" checked={Number(f.a) === i} onChange={() => set("a", i)} />
                  <span>{LETTERS[i]}</span>
                </label>
                <input className="ctl-input" value={text} onChange={(e) => setOption(i, e.target.value)} placeholder={f.block ? `Option ${LETTERS[i]} (shown in the picture)` : `Option ${LETTERS[i]}`} />
                <button type="button" className="ctl-icon" onClick={() => pickImage(i)} title="Picture for this option" aria-label={`Picture for option ${LETTERS[i]}`}>
                  {uploading === i ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                </button>
                {f.oi?.[i] && <button type="button" className="ctl-icon" onClick={() => setF((x) => { const oi = [...x.oi]; oi[i] = null; return { ...x, oi }; })} title="Remove option picture" aria-label={`Remove picture for option ${LETTERS[i]}`}><X size={14} /></button>}
                {f.o.length > 2 && !f.block && <button type="button" className="ctl-icon is-danger" onClick={() => dropOption(i)} title="Remove option" aria-label={`Remove option ${LETTERS[i]}`}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[0.72rem] text-text-muted">Tick the letter of the correct answer.</p>
        </div>

        <Field label="Explanation" hint="Shown after the candidate answers in practice mode, and in the review.">
          <textarea className="ctl-input min-h-[5rem]" value={f.e} onChange={(e) => set("e", e.target.value)} placeholder="Why the answer is right" />
        </Field>

        {f.p != null ? (
          <p className="ctl-note">This question belongs to a passage set in the shipped bank. The passage shows in the preview.</p>
        ) : (
          <details className="ctl-details" open={!!f.pt}>
            <summary>Passage (for comprehension or literature)</summary>
            <div className="mt-3 space-y-3">
              <Field label="Instruction"><input className="ctl-input" value={f.ph} onChange={(e) => set("ph", e.target.value)} placeholder="Read the passage carefully and answer the question that follows" /></Field>
              <Field label="Passage" hint="Leave a blank line between paragraphs."><textarea className="ctl-input min-h-[8rem]" value={f.pt} onChange={(e) => set("pt", e.target.value)} /></Field>
            </div>
          </details>
        )}

        <Field label="Note for the team (optional)">
          <input className="ctl-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Corrected option C from the 2019 paper" />
        </Field>

        {err && <p className="ctl-error" role="alert">{err}</p>}

        <div>
          <span className="acx-label">Preview</span>
          <div className="ctl-preview">
            <UtmeQuestion q={preview.q} number={1} selected={null} reveal passage={preview.passage} rtl={subject.rtl} />
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ── bulk upload ─────────────────────────────────────────────────────────────

const TEMPLATE_HEAD = ["year", "topic", "question", "option_a", "option_b", "option_c", "option_d", "option_e", "answer", "explanation", "passage_instruction", "passage"];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** One uploaded row → bank data, or an error message. */
function rowToData(r, topics) {
  const get = (k) => String(r[k] ?? "").trim();
  const o = ["option_a", "option_b", "option_c", "option_d", "option_e"].map(get);
  while (o.length && !o[o.length - 1]) o.pop();
  const ans = get("answer").toUpperCase();
  const a = /^[A-E]$/.test(ans) ? LETTERS.indexOf(ans) : /^[0-4]$/.test(ans) ? Number(ans) : -1;
  const y = Number(get("year"));
  const problems = [];
  if (!get("question")) problems.push("question is empty");
  if (o.length < 2) problems.push("needs at least two options");
  if (o.some((x) => !x)) problems.push("an option in the middle is empty");
  if (a < 0 || a >= o.length) problems.push("answer must be a letter of one of the options");
  if (!(y >= 1970 && y <= 2100)) problems.push("year is missing or wrong");
  if (!get("topic")) problems.push("topic is empty");
  if (problems.length) return { error: problems.join(", ") };
  const data = { s: get("question"), o, a, y, e: get("explanation") || null };
  const t = topics.indexOf(get("topic"));
  if (t >= 0) data.t = t; else data.tn = get("topic");
  if (get("passage")) { data.pt = get("passage"); if (get("passage_instruction")) data.ph = get("passage_instruction"); }
  return { data };
}

function BulkUpload({ slug, subjectName, topics, onClose, onDone }) {
  const [parsed, setParsed] = useState(null); // [{ n, data?, error? }]
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const inputRef = useRef(null);

  function downloadTemplate() {
    const sample = [TEMPLATE_HEAD, ["2024", topics[0] || "Topic name", "Which of the following is a **vector** quantity?", "Mass", "Speed", "Velocity", "Time", "", "C", "Velocity has size and direction.", "", ""]];
    const csv = sample.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `utme-${slug}-template.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onFile(file) {
    if (!file) return;
    setFileName(file.name);
    setServerErrors([]);
    const text = await file.text();
    let records = [];
    try {
      if (/\.json$/i.test(file.name) || text.trim().startsWith("[")) {
        const arr = JSON.parse(text);
        records = (Array.isArray(arr) ? arr : arr.questions || []).map((x) => {
          if (Array.isArray(x.o)) return { bank: x };
          return x;
        });
      } else {
        const rows = parseCsv(text.replace(/^\uFEFF/, ""));
        const head = rows.shift()?.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")) || [];
        records = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
      }
    } catch {
      notify.error("That file couldn't be read. Use the CSV template or a JSON list.");
      return;
    }
    setParsed(records.map((r, i) => {
      if (r.bank) {
        const { id, ...rest } = r.bank; // eslint-disable-line no-unused-vars
        return { n: i + 1, data: rest };
      }
      return { n: i + 1, ...rowToData(r, topics) };
    }));
  }

  const good = parsed?.filter((r) => r.data) || [];
  const bad = parsed?.filter((r) => r.error) || [];

  async function upload() {
    if (!good.length) return;
    setBusy(true);
    setServerErrors([]);
    try {
      let added = 0;
      for (let i = 0; i < good.length; i += 500) {
        const res = await utmeAdminApi.bulk(slug, good.slice(i, i + 500).map((r) => r.data));
        added += res.added;
      }
      notify.success(`${added.toLocaleString()} question${added === 1 ? "" : "s"} added to ${subjectName}`);
      onDone();
    } catch (e) {
      setServerErrors(e.data?.errors || []);
      notify.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open onClose={onClose} subtitle={subjectName} title="Upload questions"
      actions={<button type="button" className="ctl-btn" onClick={upload} disabled={busy || !good.length}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload {good.length ? good.length.toLocaleString() : ""}</button>}>
      <div className="ctl space-y-5">
        <p className="text-sm text-text-secondary">
          Upload a CSV with one question per row, or a JSON list. Columns: <span className="num text-text-primary">{TEMPLATE_HEAD.join(", ")}</span>. The answer is a letter, A to E. A topic that doesn't exist yet is created.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ctl-btn is-ghost" onClick={downloadTemplate}><Download size={14} /> Download CSV template</button>
          <button type="button" className="ctl-btn" onClick={() => inputRef.current?.click()}><FileUp size={14} /> Choose file</button>
          <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <p className="text-[0.72rem] text-text-muted">Pictures can't go in a file. Upload the questions first, then open each one to add its diagram.</p>

        {parsed && (
          <div className="space-y-3">
            <p className="text-sm"><b>{fileName}</b>: <span className="num">{good.length}</span> ready{bad.length ? <>, <span className="num text-status-danger">{bad.length}</span> need fixing (they'll be left out)</> : null}.</p>
            {bad.length > 0 && (
              <ul className="ctl-errlist">
                {bad.slice(0, 30).map((r) => <li key={r.n}>Row <span className="num">{r.n}</span>: {r.error}</li>)}
                {bad.length > 30 && <li>…and {bad.length - 30} more</li>}
              </ul>
            )}
            {serverErrors.length > 0 && (
              <ul className="ctl-errlist">
                {serverErrors.map((r) => <li key={r.row}>Row <span className="num">{r.row}</span>: {r.error}</li>)}
              </ul>
            )}
            {good.length > 0 && (
              <div className="overflow-x-auto">
                <table className="ctl-table">
                  <thead><tr><th className="w-12">Row</th><th className="w-16">Year</th><th>Question</th><th className="w-16">Answer</th></tr></thead>
                  <tbody>
                    {good.slice(0, 12).map((r) => (
                      <tr key={r.n}><td className="num text-text-muted">{r.n}</td><td className="num">{r.data.y}</td><td className="truncate">{plain(r.data.s)}</td><td className="num">{LETTERS[r.data.a]}</td></tr>
                    ))}
                  </tbody>
                </table>
                {good.length > 12 && <p className="mt-2 text-xs text-text-muted">Showing 12 of {good.length.toLocaleString()}.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ── changes & team ──────────────────────────────────────────────────────────

function ChangesTab({ index, onOpen }) {
  const [items, setItems] = useState(null);
  useEffect(() => { utmeAdminApi.patches().then((r) => setItems(r.items || [])).catch(() => setItems([])); }, []);
  const name = (slug) => index?.subjects?.find((s) => s.slug === slug)?.name || slug;
  if (!items) return <div className="ctl-panel flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading changes…</div>;
  if (!items.length) return <div className="ctl-panel text-sm text-text-muted">No changes yet. Edits, removals and new questions show here with who made them.</div>;
  return (
    <section className="ctl-panel !p-0 overflow-x-auto">
      <table className="ctl-table">
        <thead><tr><th className="w-36">When</th><th className="w-40">Who</th><th className="w-40">Subject</th><th className="w-24">Question</th><th className="w-24">Change</th><th>Note</th><th className="w-20" /></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={`${p.slug}:${p.qid}`}>
              <td className="text-text-secondary">{fmtWhen(p.updatedAt)}</td>
              <td className="truncate">{p.by?.name || "—"}</td>
              <td className="truncate">{name(p.slug)}</td>
              <td className="num text-text-muted">{p.qid}</td>
              <td><span className={`ctl-status is-${p.status}`}>{STATUS_LABEL[p.status]}</span></td>
              <td className="truncate text-text-secondary">{p.note || plain(p.data?.s).slice(0, 90)}</td>
              <td className="text-right"><button type="button" className="text-xs font-semibold text-accent" onClick={() => onOpen(p.slug)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TeamTab({ admin, consoleBase }) {
  const [people, setPeople] = useState(null);
  useEffect(() => { utmeAdminApi.team().then((r) => setPeople(r.people || [])).catch(() => setPeople([])); }, []);
  return (
    <section className="space-y-3">
      <div className="ctl-panel flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-text-secondary">
          Admins can always manage the bank. Agents need the <b className="text-text-primary">UTME question bank</b> permission, which agents get by default. Turn it on or off for each person in Staff access.
        </p>
        {admin && <Link to={`${consoleBase}/access`} className="ctl-btn is-ghost">Open Staff access</Link>}
      </div>
      <div className="ctl-panel !p-0 overflow-x-auto">
        {!people ? (
          <div className="flex items-center gap-2 p-5 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading team…</div>
        ) : (
          <table className="ctl-table">
            <thead><tr><th>Name</th><th className="w-32">Role</th><th className="w-28">Changes</th><th className="w-40">Last change</th></tr></thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id}>
                  <td><span className="font-semibold text-text-primary">{u.name}</span> <span className="text-xs text-text-muted">{u.email}</span></td>
                  <td className="text-text-secondary">{{ admin: "Admin", alphaAgent: "Alpha agent", agent: "Agent" }[u.role] || u.role}</td>
                  <td className="num">{u.changes.toLocaleString()}</td>
                  <td className="text-text-secondary">{u.lastChange ? fmtWhen(u.lastChange) : "—"}</td>
                </tr>
              ))}
              {!people.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-text-muted">No one else can manage the bank yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}



// ── question reports from candidates ────────────────────────────────────────
function ReportsTab({ index, onOpen }) {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);
  const name = (slug) => index?.subjects?.find((s) => s.slug === slug)?.name || slug;
  const load = () => utmeCoachApi.adminReports({ status }).then(setData).catch(() => setData({ items: [] }));
  useEffect(() => { setData(null); load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  async function resolve(r, next) {
    const resolution = await appPrompt(next === "fixed" ? "Reporters are told the question was fixed. Edit it in Questions first." : "Nobody is notified.", { title: next === "fixed" ? "Mark as fixed" : "Dismiss reports", placeholder: next === "fixed" ? "What changed (shown to reporters)" : "Why (for the team)", confirmLabel: next === "fixed" ? "Mark fixed" : "Dismiss" });
    if (resolution === null) return;
    try { await utmeCoachApi.resolve({ slug: r.slug, qid: r.qid, status: next, resolution: resolution || null }); load(); } catch (e) { notify.error(e.message); }
  }
  return (
    <div className="space-y-3">
      <div className="utme-filter">
        {[["open", "Open"], ["fixed", "Fixed"], ["dismissed", "Dismissed"]].map(([k, l]) => <button type="button" key={k} className={status === k ? "is-on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      {!data ? <div className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</div> : !data.items.length ? (
        <div className="ctl-panel text-sm text-text-secondary">{status === "open" ? "No open reports. Candidates use Report on a question in review to flag mistakes." : "Nothing here."}</div>
      ) : (
        <section className="ctl-panel !p-0 overflow-x-auto">
          <table className="ctl-table min-w-[760px]">
            <thead><tr><th className="w-40">Subject</th><th className="w-24">Question</th><th className="w-20">Reports</th><th>What they said</th><th className="w-32">Last</th><th className="w-64" /></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={`${r.slug}:${r.qid}`}>
                  <td className="truncate">{name(r.slug)}</td>
                  <td className="num text-text-muted">{r.qid}</td>
                  <td className="num">{r.count}</td>
                  <td className="truncate" title={r.notes.map((n) => n.note).join(" | ")}>{r.reasons.map((x) => `${x.label}${x.count > 1 ? ` ×${x.count}` : ""}`).join(", ")}{r.notes[0] ? ` — “${r.notes[0].note}”` : ""}{r.resolution ? ` · ${r.resolution}` : ""}</td>
                  <td className="text-text-secondary">{fmtWhen(r.lastAt)}</td>
                  <td className="text-right">
                    <span className="inline-flex gap-1.5">
                      <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => onOpen(r.slug, r.qid)}>Open</button>
                      {status === "open" && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => resolve(r, "fixed")}>Fixed</button>}
                      {status === "open" && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => resolve(r, "dismissed")}>Dismiss</button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

// ── what candidates get wrong ───────────────────────────────────────────────
function InsightsTab({ index, onOpen }) {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const name = (slug) => index?.subjects?.find((s) => s.slug === slug)?.name || slug;
  useEffect(() => { setData(null); utmeCoachApi.stats({ days }).then(setData).catch(() => setData(null)); }, [days]);
  return (
    <div className="space-y-4">
      <div className="utme-filter">{[30, 90, 365].map((d) => <button type="button" key={d} className={days === d ? "is-on" : ""} onClick={() => setDays(d)}>{d === 365 ? "Year" : `${d} days`}</button>)}</div>
      {!data ? <div className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</div> : (
        <>
          <div className="prog-strip">
            <div><dt>Sessions</dt><dd className="num">{data.sessions.toLocaleString()}</dd></div>
            <div><dt>Open reports</dt><dd className="num">{data.openReports}</dd></div>
            <div><dt>Subjects practised</dt><dd className="num">{data.subjects.length}</dd></div>
          </div>
          <section className="ctl-panel !p-0 overflow-x-auto">
            <h2 className="ctl-panel-title">Accuracy by subject</h2>
            <table className="ctl-table">
              <thead><tr><th>Subject</th><th className="w-28">Sessions</th><th className="w-32">Answered</th><th className="w-28">Right</th></tr></thead>
              <tbody>{data.subjects.map((s) => <tr key={s.slug}><td>{s.name}</td><td className="num">{s.sessions}</td><td className="num">{s.answered.toLocaleString()}</td><td className="num">{s.accuracy}%</td></tr>)}</tbody>
            </table>
          </section>
          <section className="ctl-panel !p-0 overflow-x-auto">
            <h2 className="ctl-panel-title">Most missed questions (answered at least 3 times)</h2>
            {!data.mostMissed.length ? <p className="px-4 py-4 text-sm text-text-secondary">Not enough answers yet.</p> : (
              <table className="ctl-table">
                <thead><tr><th>Subject</th><th className="w-24">Question</th><th className="w-28">Missed</th><th className="w-28">Miss rate</th><th className="w-20" /></tr></thead>
                <tbody>{data.mostMissed.map((m) => (
                  <tr key={`${m.slug}:${m.qid}`}>
                    <td>{name(m.slug)}</td><td className="num text-text-muted">{m.qid}</td>
                    <td className="num">{m.missed}/{m.answered}</td><td className="num">{m.missRate}%</td>
                    <td className="text-right"><button type="button" className="text-xs font-semibold text-accent" onClick={() => onOpen(m.slug, m.qid)}>Check</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <p className="px-4 py-2 text-xs text-text-muted">A very high miss rate often means a wrong answer key. Check those first.</p>
          </section>
        </>
      )}
    </div>
  );
}
