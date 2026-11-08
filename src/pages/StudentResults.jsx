/**
 * CGPA & results: enter each semester's courses (units + grade), see the GPA,
 * the running CGPA and the class of degree it points to, and plan what you
 * need to reach a target.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { PageHeader } from "../components/ui";
import { resultsApi } from "../lib/gapsApi";
import { myCoursesApi } from "../lib/api";
import { appConfirm, notify } from "../lib/dialogs";

const GRADES = ["A", "B", "C", "D", "E", "F"];
const POINTS = {
  5: { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 },
  4: { A: 4, B: 3, C: 2, D: 1, E: 0, F: 0 },
};
/** Common Nigerian bands. Your institution's handbook is the final word. */
const CLASSES = {
  5: [[4.5, "First Class"], [3.5, "Second Class Upper (2:1)"], [2.4, "Second Class Lower (2:2)"], [1.5, "Third Class"], [1.0, "Pass"], [0, "Below pass"]],
  4: [[3.5, "Distinction"], [3.0, "Upper Credit"], [2.5, "Lower Credit"], [2.0, "Pass"], [0, "Below pass"]],
};
const SEM_LABEL = { first: "First semester", second: "Second semester", third: "Third term" };
const SEM_ORDER = { first: 1, second: 2, third: 3 };

const classOf = (scale, cgpa) => (CLASSES[scale].find(([min]) => cgpa >= min) || [0, "—"])[1];
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

function gpa(rows, scale) {
  const units = rows.reduce((n, r) => n + Number(r.units || 0), 0);
  const points = rows.reduce((n, r) => n + Number(r.units || 0) * (POINTS[scale][r.grade] ?? 0), 0);
  return { units, points, gpa: units ? points / units : NaN };
}

function currentSession() {
  const d = new Date();
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

export default function StudentResults() {
  const [items, setItems] = useState(null);
  const [scale, setScale] = useState(5);
  const [target, setTarget] = useState("");
  const [planned, setPlanned] = useState("");
  const [editing, setEditing] = useState(null); // { session, semester, rows, isNew }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    resultsApi.list().then((r) => {
      setItems(r.items);
      setScale(r.scale);
      setTarget(r.target ?? "");
      setPlanned(r.plannedUnits ?? "");
    }).catch((e) => { notify.error(e.message); setItems([]); });
  }, []);

  const semesters = useMemo(() => {
    const map = new Map();
    for (const r of items || []) {
      const k = `${r.session}|${r.semester}`;
      if (!map.has(k)) map.set(k, { session: r.session, semester: r.semester, rows: [] });
      map.get(k).rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.session.localeCompare(b.session) || SEM_ORDER[a.semester] - SEM_ORDER[b.semester]);
  }, [items]);

  const overall = gpa(items || [], scale);
  const plan = useMemo(() => {
    const t = Number(target), u = Number(planned);
    if (!t || !u || !overall.units) return null;
    const need = (t * (overall.units + u) - overall.points) / u;
    return { need, possible: need <= scale, already: need <= 0 };
  }, [target, planned, overall.units, overall.points, scale]);

  async function saveSettings(next) {
    try { await resultsApi.saveSettings(next); } catch (e) { notify.error(e.message); }
  }

  function startNew() {
    const last = semesters[semesters.length - 1];
    let session = currentSession(), semester = "first";
    if (last) {
      if (last.semester === "first") { session = last.session; semester = "second"; }
      else { const y = Number(last.session.slice(0, 4)) + 1; session = `${y}/${y + 1}`; semester = "first"; }
    }
    setEditing({ session, semester, rows: [{ courseCode: "", courseTitle: "", units: 3, grade: "A" }], isNew: true });
  }

  async function fillFromMyCourses() {
    try {
      const r = await myCoursesApi.list();
      const rows = (r.courses || []).filter((c) => c.code).map((c) => ({ courseCode: c.code, courseTitle: c.title, units: c.units ?? 3, grade: "A" }));
      if (!rows.length) return notify.info("Add courses on the Courses page first.");
      setEditing((e) => ({ ...e, rows }));
    } catch (e) { notify.error(e.message); }
  }

  async function saveSemester() {
    const rows = editing.rows.filter((r) => r.courseCode.trim());
    if (!rows.length) return notify.error("Add at least one course.");
    setBusy(true);
    try {
      const r = await resultsApi.saveSemester({ session: editing.session, semester: editing.semester, rows: rows.map((x) => ({ ...x, units: Number(x.units) })) });
      setItems((xs) => [...xs.filter((x) => !(x.session === editing.session && x.semester === editing.semester)), ...r.items]);
      setEditing(null);
      notify.success("Semester saved");
    } catch (e) { notify.error(e.message); } finally { setBusy(false); }
  }

  async function removeSemester(s) {
    if (!(await appConfirm(`Remove ${SEM_LABEL[s.semester].toLowerCase()} ${s.session} and its ${s.rows.length} courses?`, { title: "Remove semester?", confirmLabel: "Remove", tone: "danger" }))) return;
    await resultsApi.deleteSemester(s.session, s.semester).catch((e) => notify.error(e.message));
    setItems((xs) => xs.filter((x) => !(x.session === s.session && x.semester === s.semester)));
  }

  const setRow = (i, patch) => setEditing((e) => ({ ...e, rows: e.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  if (!items) return <p className="text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p>;
  const editGpa = editing ? gpa(editing.rows.filter((r) => r.courseCode), scale) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="CGPA & results" description="Enter your grades each semester. Academicall works out your GPA, your CGPA and where it's heading." actions={!editing && <button type="button" className="ctl-btn" onClick={startNew}><Plus size={14} /> Add a semester</button>} />

      <div className="prog-strip">
        <div><dt>CGPA</dt><dd className="num text-[1.6rem]">{fmt(overall.gpa)}<span className="text-sm text-text-muted"> / {scale}.00</span></dd></div>
        <div><dt>Class</dt><dd>{overall.units ? classOf(scale, overall.gpa) : "—"}</dd></div>
        <div><dt>Units done</dt><dd className="num">{overall.units}</dd></div>
        <div>
          <dt>Grading scale</dt>
          <dd>
            <div className="utme-filter">
              {[5, 4].map((n) => <button type="button" key={n} className={scale === n ? "is-on" : ""} onClick={() => { setScale(n); saveSettings({ scale: n, target: target === "" ? null : Number(target), plannedUnits: planned === "" ? null : Number(planned) }); }}>{n}.0</button>)}
            </div>
          </dd>
        </div>
      </div>

      {editing && (
        <section className="ctl-panel space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Session</span>
              <input className="ctl-input !w-36 num" value={editing.session} onChange={(e) => setEditing((x) => ({ ...x, session: e.target.value }))} placeholder="2025/2026" disabled={!editing.isNew} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium text-text-primary">Semester</span>
              <select className="ctl-input !w-44" value={editing.semester} onChange={(e) => setEditing((x) => ({ ...x, semester: e.target.value }))} disabled={!editing.isNew}>
                {Object.entries(SEM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            {editing.isNew && <button type="button" className="ctl-btn is-ghost" onClick={fillFromMyCourses}>Use my courses</button>}
            <p className="ml-auto text-sm text-text-secondary">GPA <b className="num text-text-primary">{fmt(editGpa.gpa)}</b> · <span className="num">{editGpa.units}</span> units</p>
          </div>
          <table className="ctl-table">
            <thead><tr><th className="w-32">Code</th><th>Title</th><th className="w-20">Units</th><th className="w-24">Grade</th><th className="w-12" /></tr></thead>
            <tbody>
              {editing.rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="ctl-input num" value={r.courseCode} onChange={(e) => setRow(i, { courseCode: e.target.value.toUpperCase() })} placeholder="CSC 101" /></td>
                  <td><input className="ctl-input" value={r.courseTitle || ""} onChange={(e) => setRow(i, { courseTitle: e.target.value })} placeholder="Optional" /></td>
                  <td><input className="ctl-input num" type="number" min="0" max="30" value={r.units} onChange={(e) => setRow(i, { units: e.target.value })} /></td>
                  <td><select className="ctl-input" value={r.grade} onChange={(e) => setRow(i, { grade: e.target.value })}>{GRADES.map((g) => <option key={g} value={g}>{g} ({POINTS[scale][g]})</option>)}</select></td>
                  <td><button type="button" className="ctl-icon is-danger" onClick={() => setEditing((x) => ({ ...x, rows: x.rows.filter((_, j) => j !== i) }))} aria-label="Remove course"><X size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ctl-btn is-ghost" onClick={() => setEditing((x) => ({ ...x, rows: [...x.rows, { courseCode: "", courseTitle: "", units: 3, grade: "A" }] }))}><Plus size={14} /> Add course</button>
            <span className="flex-1" />
            <button type="button" className="ctl-btn is-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="ctl-btn" onClick={saveSemester} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save semester</button>
          </div>
        </section>
      )}

      {!semesters.length && !editing && (
        <div className="ctl-panel text-sm text-text-secondary">No results yet. Add your first semester to see your CGPA.</div>
      )}

      {semesters.map((s, idx) => {
        const g = gpa(s.rows, scale);
        const upTo = gpa(semesters.slice(0, idx + 1).flatMap((x) => x.rows), scale);
        return (
          <section key={`${s.session}|${s.semester}`} className="ctl-panel !p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3">
              <h2 className="font-semibold text-text-primary">{SEM_LABEL[s.semester]} · <span className="num">{s.session}</span></h2>
              <span className="text-sm text-text-secondary">GPA <b className="num text-text-primary">{fmt(g.gpa)}</b> · CGPA so far <b className="num text-text-primary">{fmt(upTo.gpa)}</b> · <span className="num">{g.units}</span> units</span>
              <span className="ml-auto flex gap-1.5">
                <button type="button" className="ctl-icon" onClick={() => setEditing({ session: s.session, semester: s.semester, rows: s.rows.map((r) => ({ courseCode: r.courseCode, courseTitle: r.courseTitle || "", units: r.units, grade: r.grade })), isNew: false })} aria-label="Edit semester"><Pencil size={14} /></button>
                <button type="button" className="ctl-icon is-danger" onClick={() => removeSemester(s)} aria-label="Remove semester"><Trash2 size={14} /></button>
              </span>
            </div>
            <table className="ctl-table">
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="w-32 num">{r.courseCode}</td>
                    <td>{r.courseTitle || ""}</td>
                    <td className="w-20 num">{r.units} u</td>
                    <td className="w-16 font-semibold">{r.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <section className="ctl-panel space-y-3">
        <h2 className="font-semibold text-text-primary">Reach a target</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-text-secondary">Target CGPA</span>
            <input type="number" step="0.01" min="0" max={scale} className="ctl-input !w-28 num" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => saveSettings({ scale, target: target === "" ? null : Number(target), plannedUnits: planned === "" ? null : Number(planned) })} placeholder={scale === 5 ? "4.50" : "3.50"} /></label>
          <label className="text-sm"><span className="mb-1 block text-text-secondary">Units left to take</span>
            <input type="number" min="0" className="ctl-input !w-28 num" value={planned} onChange={(e) => setPlanned(e.target.value)} onBlur={() => saveSettings({ scale, target: target === "" ? null : Number(target), plannedUnits: planned === "" ? null : Number(planned) })} placeholder="e.g. 96" /></label>
        </div>
        {plan ? (
          <p className="text-sm text-text-secondary">
            {plan.already ? "You're already above that target. Keep it steady."
              : plan.possible ? <>You need an average of <b className="num text-text-primary">{fmt(plan.need)}</b> across the remaining {planned} units ({classOf(scale, plan.need)} level grades).</>
              : <>That needs <b className="num">{fmt(plan.need)}</b> per unit, above the {scale}.00 maximum. Aim for {classOf(scale, Math.min(scale, (overall.points + scale * Number(planned)) / (overall.units + Number(planned))))} — the best still possible is <b className="num text-text-primary">{fmt((overall.points + scale * Number(planned)) / (overall.units + Number(planned)))}</b>.</>}
          </p>
        ) : <p className="text-sm text-text-muted">Enter a target and the units you still have to take.</p>}
        <p className="text-xs text-text-muted">Class bands follow the common Nigerian scale. Check your institution's handbook for its exact cut-offs.</p>
      </section>
    </div>
  );
}
