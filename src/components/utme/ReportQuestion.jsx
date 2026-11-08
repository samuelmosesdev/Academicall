/** "Report this question" — wrong answer, typo, missing picture… goes to the UTME control room. */
import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { utmeCoachApi } from "../../lib/gapsApi";
import { notify } from "../../lib/dialogs";

const REASONS = [
  ["wrong_answer", "Wrong answer"],
  ["typo", "Typo or wrong spelling"],
  ["missing_image", "Picture or diagram missing"],
  ["unclear", "Question is unclear"],
  ["wrong_topic", "Wrong topic or year"],
  ["other", "Something else"],
];

export default function ReportQuestion({ slug, qid }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!slug || !qid) return null;
  if (sent) return <span className="ml-auto text-xs text-text-muted">Reported. Thanks.</span>;

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await utmeCoachApi.report({ slug, qid: String(qid), reason, note: note.trim() || null });
      setSent(true);
      notify.success("Thanks. The UTME team will check it.");
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative ml-auto">
      <button type="button" className="report-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Report this question"><Flag size={12} /> <span className="hidden sm:inline">Report</span></button>
      {open && (
        <form onSubmit={send} className="rq-pop" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold text-text-primary">What's wrong with this question?</p>
          <div className="mt-2 space-y-1">
            {REASONS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="radio" name={`rq-${qid}`} checked={reason === k} onChange={() => setReason(k)} /> {label}
              </label>
            ))}
          </div>
          <textarea className="ctl-input mt-2" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === "wrong_answer" ? "Which option is right, and why?" : "Details (optional)"} />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="ctl-btn is-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="ctl-btn" disabled={!reason || busy}>{busy && <Loader2 size={13} className="animate-spin" />} Send</button>
          </div>
        </form>
      )}
    </span>
  );
}
