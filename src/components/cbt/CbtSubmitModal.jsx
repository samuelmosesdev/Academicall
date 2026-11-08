import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * "Submit your answers?" — a last look before the paper is marked.
 * Lists unanswered and flagged question numbers so the student can jump back to them.
 */
export default function CbtSubmitModal({
  open,
  onClose,
  onConfirm,
  onJump,
  stats,
  timeLeft,
  courseLabel,
  total,
  unansweredNumbers = [],
  flaggedNumbers = [],
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mins = timeLeft != null ? Math.floor(timeLeft / 60) : null;
  const secs = timeLeft != null ? timeLeft % 60 : null;
  const allDone = stats.unattempted === 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-midnight/55 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cbt-submit-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-md rounded-t-[1.5rem] border border-border-subtle bg-bg-panel p-5 shadow-2xl sm:rounded-[1.5rem] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-text-muted">{courseLabel}</p>
            <h2 id="cbt-submit-title" className="mt-1.5 text-lg text-text-primary">
              {allDone ? "Submit your answers?" : `${stats.unattempted} question${stats.unattempted === 1 ? "" : "s"} still unanswered`}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-full p-2 text-text-muted hover:bg-bg-hover" aria-label="Back to the paper"><X size={18} /></button>
        </div>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-border-subtle rounded-2xl border border-border-subtle text-center">
          <div className="px-2 py-3">
            <dt className="text-[0.7rem] text-text-muted">Answered</dt>
            <dd className="num mt-0.5 text-xl font-semibold text-text-primary">{stats.answered}<span className="text-sm font-normal text-text-muted">/{total}</span></dd>
          </div>
          <div className="px-2 py-3">
            <dt className="text-[0.7rem] text-text-muted">Flagged</dt>
            <dd className="num mt-0.5 text-xl font-semibold text-status-warning">{stats.flagged}</dd>
          </div>
          <div className="px-2 py-3">
            <dt className="text-[0.7rem] text-text-muted">{timeLeft != null ? "Time left" : "Blank"}</dt>
            <dd className="num mt-0.5 text-xl font-semibold text-text-primary">
              {timeLeft != null ? `${mins}:${String(secs).padStart(2, "0")}` : stats.unattempted}
            </dd>
          </div>
        </dl>

        {(unansweredNumbers.length > 0 || flaggedNumbers.length > 0) && onJump && (
          <div className="mt-4 space-y-3">
            <NumberRow label="Unanswered" numbers={unansweredNumbers} onJump={onJump} />
            <NumberRow label="Flagged" numbers={flaggedNumbers} onJump={onJump} tone="flag" />
          </div>
        )}

        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          Once you submit, the paper is marked and you can't change an answer. You'll see every correct answer with its explanation.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="acx-btn-ghost justify-center !py-2.5">Keep working</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className="acx-btn justify-center !py-2.5">Submit and mark</button>
        </div>
      </div>
    </div>
  );
}

function NumberRow({ label, numbers, onJump, tone }) {
  if (!numbers.length) return null;
  const shown = numbers.slice(0, 24);
  return (
    <div>
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {shown.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onJump(n - 1)}
            className={`num h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition hover:border-accent hover:text-accent ${tone === "flag" ? "border-status-warning/40 bg-lemon-soft text-midnight dark:bg-lemon/10 dark:text-lemon" : "border-border-subtle bg-bg-panel-alt text-text-primary"}`}
          >
            {n}
          </button>
        ))}
        {numbers.length > shown.length && <span className="self-center text-xs text-text-muted">+{numbers.length - shown.length} more</span>}
      </div>
    </div>
  );
}
