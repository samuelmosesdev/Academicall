/** Tests set for me by Academicall staff: open now, coming up, and done. */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Timer, ListChecks } from "lucide-react";
import { PageHeader } from "../components/ui";
import { testsApi, fmtDateTime } from "../lib/gapsApi";

const STATE_LABEL = { open: "Open now", in_progress: "In progress", upcoming: "Coming up", done: "Done", closed: "Closed" };

export default function StudentTests() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [params] = useSearchParams();
  const focus = params.get("open");
  useEffect(() => { testsApi.mine().then((r) => setItems(r.items)).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="ctl-error">{err}</p>;
  if (!items) return <p className="text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading tests…</p>;

  const live = items.filter((t) => t.state === "open" || t.state === "in_progress");
  const soon = items.filter((t) => t.state === "upcoming");
  const past = items.filter((t) => t.state === "done" || t.state === "closed");

  const Row = ({ t }) => (
    <li className={`ctl-feature ${focus === t.id ? "is-focus" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">{t.title}<span className={`ctl-status ${t.state === "open" || t.state === "in_progress" ? "is-added" : t.state === "upcoming" ? "is-edited" : ""}`}>{STATE_LABEL[t.state]}</span></p>
        <p className="text-sm text-text-secondary">
          <span className="num">{t.questionCount}</span> questions · <Timer size={12} className="inline" /> {t.durationMin} min
          {(t.sections || []).length > 1 ? ` · ${t.sections.map((s) => s.name).join(", ")}` : ""}
        </p>
        <p className="text-xs text-text-muted">
          {t.state === "upcoming" && t.opensAt ? `Opens ${fmtDateTime(t.opensAt)}` : null}
          {t.closesAt && t.state !== "closed" ? `${t.state === "upcoming" ? " · " : ""}Closes ${fmtDateTime(t.closesAt)}` : null}
          {t.createdByName ? ` · Set by ${t.createdByName}` : ""}
          {t.maxAttempts > 1 ? ` · ${t.attemptsUsed}/${t.maxAttempts} attempts used` : ""}
        </p>
      </div>
      {t.state === "in_progress" && <Link className="ctl-btn" to={`/test/${t.id}`}>Continue</Link>}
      {t.state === "open" && <Link className="ctl-btn" to={`/test/${t.id}`}>Start</Link>}
      {(t.state === "done" || t.state === "closed") && t.best && (
        t.resultsVisible ? <Link className="ctl-btn is-ghost" to={`/test/${t.id}`}>{t.best.score != null ? `${t.best.score}% · Review` : "Review"}</Link>
          : <span className="text-xs text-text-muted">Submitted. Results later.</span>
      )}
      {(t.state === "closed") && !t.best && <span className="text-xs text-text-muted">Missed</span>}
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Tests" description="Timed tests Academicall staff set for you. Once you start, the clock runs even if you leave, so start when you're ready." />
      {!items.length && <div className="ctl-panel flex items-center gap-3 text-sm text-text-secondary"><ListChecks size={18} /> No tests for you yet. You'll get a notification when one is set.</div>}
      {[["Open now", live], ["Coming up", soon], ["Past tests", past]].map(([title, list]) => list.length ? (
        <section key={title} className="ctl-panel !p-0">
          <h2 className="ctl-panel-title">{title}</h2>
          <ul>{list.map((t) => <Row key={t.id} t={t} />)}</ul>
        </section>
      ) : null)}
    </div>
  );
}
