import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { logActivity } from "../lib/activityLog";
import { classEventsApi } from "../lib/api";

const field =
  "w-full rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

/**
 * Quick "Schedule class" composer used on the Department page.
 * Writes to `classEvents` exactly like the Course Rep panel does,
 * so students see it instantly via the live listener.
 */
export default function ScheduleClassModal({
  open,
  onClose,
  department,
  level,
  faculty,
  user,
  authorName,
}) {
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setTitle("");
    setCourseCode("");
    setVenue("");
    setStartsAt("");
    setEndsAt("");
    setNotes("");
    setErr("");
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!title.trim() || !startsAt) {
      setErr("Title and start time are required.");
      return;
    }
    setBusy(true);
    try {
      const start = new Date(startsAt);
      const end = endsAt ? new Date(endsAt) : null;
      const { event } = await classEventsApi.create({
        title: title.trim(),
        courseCode: courseCode.trim().toUpperCase() || null,
        venue: venue.trim() || null,
        notes: notes.trim() || null,
        startsAt: start.toISOString(),
        endsAt: end ? end.toISOString() : null,
        faculty: faculty || null,
        department,
        level: level || null,
        createdByName: authorName || user?.email || "Course Rep",
      });
      await logActivity({
        actorUid: user?.uid,
        actorName: authorName || user?.email,
        action: "class.schedule",
        targetUid: null,
        targetName: null,
        reference: event.id,
        meta: { title: title.trim(), department, level },
      });
      reset();
      onClose?.(true);
    } catch (ex) {
      setErr(ex.message || "Failed to schedule. Check Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Schedule a class">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-ink-muted">
          Students in <strong className="text-ink">{department}</strong>
          {level ? ` · ${level}` : ""} will see this immediately.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title * e.g. Week 5 — Tutorial"
          className={field}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            placeholder="Course code (optional)"
            className={field}
          />
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue / Zoom link"
            className={field}
          />
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Start *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={field}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">End</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={field}
            />
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes (optional)"
          className={field}
        />
        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-border-light px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CalendarPlus size={15} />
            )}
            Schedule class
          </button>
        </div>
      </form>
    </Modal>
  );
}
