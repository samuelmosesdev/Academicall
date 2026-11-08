import { useState } from "react";
import { CalendarDays, Clock3, Minus, Plus, Timer } from "lucide-react";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import {
  formatDateShort,
  formatDuration,
  formatTime,
  lectureRange,
} from "./dateUtils";

export const DURATIONS = [30, 60, 90, 120, 180];
export const EMPTY_WHEN = { date: "", time: "", duration: 60 };

/**
 * The "when" part of a lecture: date, class time and duration.
 * The end time is worked out from the duration, so course reps never type it.
 *
 * value: { date: "YYYY-MM-DD", time: "HH:MM", duration: minutes }
 */
export default function LectureWhenFields({ value, onChange, invalid = false }) {
  const [openPicker, setOpenPicker] = useState(null); // "date" | "time" | null
  const custom = !DURATIONS.includes(value.duration);
  const range = lectureRange(value);

  const set = (patch) => onChange({ ...value, ...patch });

  const trigger = (filled, missing) =>
    `group flex w-full items-center gap-3 rounded-2xl border bg-bg-panel px-3.5 py-3 text-left transition hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
      missing ? "border-red-400/70" : filled ? "border-border-subtle" : "border-border-subtle"
    }`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setOpenPicker("date")}
          className={trigger(!!value.date, invalid && !value.date)}
          aria-haspopup="dialog"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
            <CalendarDays size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.66rem] font-semibold uppercase tracking-wider text-text-muted">Date</span>
            <span className={`block truncate text-sm font-semibold ${value.date ? "text-text-primary" : "text-text-muted/70"}`}>
              {value.date ? formatDateShort(value.date) : "Choose day"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpenPicker("time")}
          className={trigger(!!value.time, invalid && !value.time)}
          aria-haspopup="dialog"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
            <Clock3 size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.66rem] font-semibold uppercase tracking-wider text-text-muted">Class time</span>
            <span className={`block truncate text-sm font-semibold tabular-nums ${value.time ? "text-text-primary" : "text-text-muted/70"}`}>
              {value.time ? formatTime(value.time) : "Choose time"}
            </span>
          </span>
        </button>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-wider text-text-muted">
          <Timer size={12} /> Duration
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Duration">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={value.duration === d}
              onClick={() => set({ duration: d })}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold tabular-nums transition ${
                value.duration === d
                  ? "bg-text-primary text-bg-panel"
                  : "bg-bg-panel-alt text-text-muted hover:text-text-primary"
              }`}
            >
              {formatDuration(d)}
            </button>
          ))}
          <div
            className={`flex items-center rounded-full transition ${
              custom ? "bg-text-primary text-bg-panel" : "bg-bg-panel-alt text-text-muted"
            }`}
          >
            <button
              type="button"
              aria-label="Shorter by 15 minutes"
              onClick={() => set({ duration: Math.max(15, (value.duration || 60) - 15) })}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:opacity-70"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[3.6rem] text-center text-xs font-semibold tabular-nums">
              {custom ? formatDuration(value.duration) : "Custom"}
            </span>
            <button
              type="button"
              aria-label="Longer by 15 minutes"
              onClick={() => set({ duration: Math.min(480, (value.duration || 60) + 15) })}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:opacity-70"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl px-4 py-3 text-sm transition ${
          range ? "bg-teal-soft text-text-primary" : "bg-bg-panel-alt text-text-muted"
        }`}
        aria-live="polite"
      >
        {range ? (
          <>
            <span className="font-semibold">{formatDateShort(value.date)}</span>
            <span className="mx-1.5 text-text-muted">·</span>
            <span className="tabular-nums">
              {formatTime(value.time)} – {range.end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="ml-1.5 text-text-muted">({formatDuration(value.duration)})</span>
          </>
        ) : (
          "Pick a date and class time. The end time is worked out for you."
        )}
      </div>

      <DatePicker
        open={openPicker === "date"}
        onClose={() => setOpenPicker(null)}
        value={value.date}
        onChange={(date) => set({ date })}
      />
      <TimePicker
        open={openPicker === "time"}
        onClose={() => setOpenPicker(null)}
        value={value.time}
        onChange={(time) => set({ time })}
      />
    </div>
  );
}
