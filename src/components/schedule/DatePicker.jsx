import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PickerSheet from "./PickerSheet";
import { fromYmd, sameDay, startOfToday, toYmd } from "./dateUtils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function nextWeekday(from, weekday /* 1 = Monday */) {
  const d = new Date(from);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  return addDays(d, diff);
}

/**
 * Calendar picker in Academicall's own style (no browser date widget).
 * value / onChange use "YYYY-MM-DD" strings.
 */
export default function DatePicker({ open, onClose, value, onChange, allowPast = false }) {
  const today = startOfToday();
  const selected = fromYmd(value);
  const [draft, setDraft] = useState(selected || today);
  const [view, setView] = useState(() => {
    const base = selected || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    const base = fromYmd(value) || startOfToday();
    setDraft(base);
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, value]);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(new Date(view.getFullYear(), view.getMonth(), d));
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const canGoBack =
    allowPast ||
    view.getFullYear() > today.getFullYear() ||
    (view.getFullYear() === today.getFullYear() && view.getMonth() > today.getMonth());

  const quick = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "Next Mon", date: nextWeekday(today, 1) },
  ];

  function pick(d) {
    setDraft(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
      setView(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  function confirm() {
    onChange?.(toYmd(draft));
    onClose?.();
  }

  function onGridKey(e) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[e.key] != null) {
      e.preventDefault();
      const next = addDays(draft, moves[e.key]);
      if (!allowPast && next < today) return;
      pick(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
  }

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title="Lecture date"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-dark"
          >
            Set date
          </button>
        </>
      }
    >
      <p className="mb-4 !font-display text-[1.55rem] !font-[420] leading-tight tracking-[-0.02em] text-text-primary">
        {draft.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" })}
      </p>

      <div className="mb-4 flex gap-2">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => pick(q.date)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              sameDay(q.date, draft)
                ? "border-teal bg-teal-soft text-teal"
                : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-panel-alt hover:text-text-primary disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>
        <span className="text-sm font-semibold text-text-primary">{monthLabel}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-panel-alt hover:text-text-primary"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[0.68rem] font-semibold uppercase tracking-wider text-text-muted">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1.5">{w}</span>
        ))}
      </div>
      <div role="grid" aria-label={monthLabel} tabIndex={0} data-autofocus onKeyDown={onGridKey} className="grid grid-cols-7 gap-y-1 outline-none">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const past = !allowPast && d < today;
          const isSel = sameDay(d, draft);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              type="button"
              tabIndex={-1}
              disabled={past}
              aria-pressed={isSel}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => pick(d)}
              onDoubleClick={() => { pick(d); onChange?.(toYmd(d)); onClose?.(); }}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm tabular-nums transition ${
                isSel
                  ? "bg-teal font-semibold text-white shadow-sm"
                  : past
                  ? "text-text-muted/35"
                  : isToday
                  ? "font-semibold text-teal ring-1 ring-inset ring-teal/40 hover:bg-teal-soft"
                  : "text-text-primary hover:bg-bg-panel-alt"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </PickerSheet>
  );
}
