import { useEffect, useState } from "react";
import PickerSheet from "./PickerSheet";
import { formatTime, pad } from "./dateUtils";

const HOURS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const MINUTES = [0, 15, 30, 45];
const COMMON = ["08:00", "09:00", "10:00", "12:00", "14:00", "16:00"];

function split(hhmm) {
  const [h, m] = (hhmm || "08:00").split(":").map(Number);
  return { h12: h % 12 === 0 ? 12 : h % 12, minute: m, pm: h >= 12 };
}

function join({ h12, minute, pm }) {
  let h = h12 % 12;
  if (pm) h += 12;
  return `${pad(h)}:${pad(minute)}`;
}

/**
 * Time picker in Academicall's own style: tap an hour, a minute and AM/PM.
 * Minutes move in 15-minute steps, which covers lecture start times;
 * "Fine-tune" adds 5-minute steps for the odd case.
 */
export default function TimePicker({ open, onClose, value, onChange }) {
  const [parts, setParts] = useState(split(value));
  const [fine, setFine] = useState(false);

  useEffect(() => {
    if (open) {
      const p = split(value);
      setParts(p);
      setFine(p.minute % 15 !== 0);
    }
  }, [open, value]);

  const minutes = fine ? Array.from({ length: 12 }, (_, i) => i * 5) : MINUTES;
  const current = join(parts);

  function confirm() {
    onChange?.(current);
    onClose?.();
  }

  const chip = (active) =>
    `flex h-10 items-center justify-center rounded-xl text-sm tabular-nums transition ${
      active
        ? "bg-teal font-semibold text-white shadow-sm"
        : "bg-bg-panel-alt text-text-primary hover:bg-bg-elevated"
    }`;

  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title="Class time"
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
            data-autofocus
            onClick={confirm}
            className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-dark"
          >
            Set time
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-end justify-between">
        <p className="!font-display text-[2.1rem] !font-[420] leading-none tracking-[-0.03em] text-text-primary tabular-nums">
          {formatTime(current).replace(/ (AM|PM)$/, "")}
          <span className="ml-1.5 text-base font-semibold tracking-normal text-text-muted">
            {parts.pm ? "PM" : "AM"}
          </span>
        </p>
        <div className="flex rounded-full bg-bg-panel-alt p-1" role="radiogroup" aria-label="AM or PM">
          {["AM", "PM"].map((label) => {
            const active = (label === "PM") === parts.pm;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setParts({ ...parts, pm: label === "PM" })}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  active ? "bg-bg-panel text-text-primary shadow-sm" : "text-text-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-text-muted">Hour</p>
      <div className="mb-4 grid grid-cols-6 gap-1.5">
        {HOURS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={parts.h12 === h}
            onClick={() =>
              // Lecture hours: 7–11 default to morning, 12–6 to afternoon.
              setParts({ ...parts, h12: h, pm: h === 12 || h <= 6 })
            }
            className={chip(parts.h12 === h)}
          >
            {h}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-text-muted">Minute</p>
        <button
          type="button"
          onClick={() => setFine(!fine)}
          className="text-[0.7rem] font-medium text-teal hover:underline"
        >
          {fine ? "15-min steps" : "Fine-tune"}
        </button>
      </div>
      <div className={`mb-4 grid gap-1.5 ${fine ? "grid-cols-6" : "grid-cols-4"}`}>
        {minutes.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={parts.minute === m}
            onClick={() => setParts({ ...parts, minute: m })}
            className={chip(parts.minute === m)}
          >
            :{pad(m)}
          </button>
        ))}
      </div>

      <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-text-muted">Common start times</p>
      <div className="flex flex-wrap gap-1.5">
        {COMMON.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setParts(split(t))}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition ${
              current === t
                ? "border-teal bg-teal-soft text-teal"
                : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary"
            }`}
          >
            {formatTime(t)}
          </button>
        ))}
      </div>
    </PickerSheet>
  );
}
