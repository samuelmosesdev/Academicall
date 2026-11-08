/**
 * UTME CBT → Progress: score trend per subject, weakest topics with a one-tap
 * drill, today's count against the daily target, streak and exam countdown.
 */
import { useEffect, useState } from "react";
import { Loader2, Target } from "lucide-react";
import { utmeCoachApi } from "../../lib/gapsApi";
import { pendingSyncCount } from "../../lib/utmeBank";
import { notify } from "../../lib/dialogs";

function Spark({ points }) {
  if (!points?.length) return null;
  const w = 140, h = 36, pad = 3;
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (points.length - 1)));
  const ys = points.map((p) => h - pad - (p.score / 100) * (h - pad * 2));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="prog-spark" aria-hidden="true">
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="prog-mid" />
      <path d={d} fill="none" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.6" />
    </svg>
  );
}

export default function UtmeProgress({ onDrill }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [goals, setGoals] = useState({ examDate: "", dailyTarget: "" });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);

  const load = () =>
    utmeCoachApi.insights().then((r) => {
      setData(r);
      setGoals({ examDate: r.goals.examDate || "", dailyTarget: r.goals.dailyTarget ?? "" });
    }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function saveGoals(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await utmeCoachApi.saveGoals({ examDate: goals.examDate || null, dailyTarget: goals.dailyTarget === "" ? null : Number(goals.dailyTarget) });
      await load();
      notify.success("Goals saved");
    } catch (e2) { notify.error(e2.message); } finally { setSaving(false); }
  }

  if (err) return <p className="ctl-error">{err}</p>;
  if (!data) return <p className="text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading your progress…</p>;

  const target = data.today.target;
  const pct = target ? Math.min(100, Math.round((data.today.answered / target) * 100)) : null;
  const waiting = pendingSyncCount();

  return (
    <div className="space-y-5">
      {waiting > 0 && <p className="ctl-note">{waiting} session{waiting === 1 ? "" : "s"} finished offline will be added when you're back online.</p>}

      <div className="prog-strip">
        <div>
          <dt>Today</dt>
          <dd className="num">{data.today.answered}{target ? <span className="text-text-muted"> / {target}</span> : null}</dd>
          {pct != null && <div className="prog-bar" aria-label={`${pct}% of today's target`}><span style={{ width: `${pct}%` }} /></div>}
        </div>
        <div><dt>Streak</dt><dd className="num">{data.streak} day{data.streak === 1 ? "" : "s"}</dd></div>
        <div><dt>Sessions</dt><dd className="num">{data.sessions}</dd></div>
        <div>
          <dt>UTME in</dt>
          <dd className="num">{data.goals.daysToExam == null ? "—" : data.goals.daysToExam > 0 ? `${data.goals.daysToExam} days` : data.goals.daysToExam === 0 ? "Today" : "Done"}</dd>
        </div>
      </div>

      <form onSubmit={saveGoals} className="ctl-panel flex flex-wrap items-end gap-3">
        <label className="text-sm text-text-secondary">
          <span className="mb-1 block font-medium text-text-primary">UTME date</span>
          <input type="date" className="ctl-input !w-44" value={goals.examDate} onChange={(e) => setGoals((g) => ({ ...g, examDate: e.target.value }))} />
        </label>
        <label className="text-sm text-text-secondary">
          <span className="mb-1 block font-medium text-text-primary">Questions a day</span>
          <input type="number" min="0" max="1000" className="ctl-input !w-32 num" value={goals.dailyTarget} onChange={(e) => setGoals((g) => ({ ...g, dailyTarget: e.target.value }))} placeholder="e.g. 60" />
        </label>
        <button type="submit" className="ctl-btn" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />} Save goals</button>
        {data.goals.daysToExam > 0 && target ? (
          <p className="text-xs text-text-muted">At {target} a day you'll answer about {(target * data.goals.daysToExam).toLocaleString()} more questions before the exam.</p>
        ) : null}
      </form>

      <section className="ctl-panel !p-0">
        <h2 className="ctl-panel-title">Work on these next</h2>
        {!data.weak.length ? (
          <p className="px-4 py-5 text-sm text-text-secondary">
            {data.hasTopicData ? "No weak spots yet: every topic you've answered at least 5 questions in is going well." : "Finish a couple of sessions and your weakest topics show up here."}
          </p>
        ) : (
          <ul>
            {data.weak.map((w) => (
              <li key={`${w.slug}:${w.topic}`} className="ctl-feature">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{w.topic}</p>
                  <p className="text-sm text-text-secondary">{w.subject} · <span className="num">{w.correct}/{w.answered}</span> right ({w.accuracy}%)</p>
                </div>
                <button type="button" className="ctl-btn is-ghost" onClick={() => onDrill(w.slug, w.topic)}>Drill this</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ctl-panel !p-0">
        <h2 className="ctl-panel-title">By subject (score out of 100, last 12 sessions)</h2>
        {!data.subjects.length && <p className="px-4 py-5 text-sm text-text-secondary">No sessions yet.</p>}
        <ul>
          {data.subjects.map((s) => (
            <li key={s.slug} className="border-b border-border-subtle last:border-0">
              <button type="button" className="prog-subject" onClick={() => setOpen(open === s.slug ? null : s.slug)} aria-expanded={open === s.slug}>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold text-text-primary">{s.name}</span>
                  <span className="block text-xs text-text-muted">{s.sessions} session{s.sessions === 1 ? "" : "s"}</span>
                </span>
                <Spark points={s.points} />
                <span className="w-16 text-right">
                  <span className="block num text-lg font-semibold text-text-primary">{s.recentAverage ?? "—"}</span>
                  {s.change != null && <span className={`block text-xs num ${s.change > 0 ? "text-[#06694f]" : s.change < 0 ? "text-status-danger" : "text-text-muted"}`}>{s.change > 0 ? "+" : ""}{s.change}</span>}
                </span>
              </button>
              {open === s.slug && (
                <div className="px-4 pb-4">
                  {!s.topics.length ? <p className="text-sm text-text-muted">Topic breakdown starts with your next session.</p> : (
                    <table className="ctl-table">
                      <thead><tr><th>Topic</th><th className="w-24">Answered</th><th className="w-24">Right</th><th className="w-28" /></tr></thead>
                      <tbody>
                        {s.topics.map((t) => (
                          <tr key={t.topic}>
                            <td title={t.topic}>{t.topic}</td>
                            <td className="num">{t.answered}</td>
                            <td className="num">{t.accuracy}%</td>
                            <td><button type="button" className="ctl-btn is-ghost !py-1" onClick={() => onDrill(s.slug, t.topic)}>Drill</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
