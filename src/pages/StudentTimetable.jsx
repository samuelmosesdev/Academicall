import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Lock,
  Clock,
  Plus,
  Trash2,
  Bell,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCbtData } from "../hooks/useCbtData";
import { isPro } from "../lib/subscription";
import SubscribeGateModal from "../components/SubscribeGateModal";
import { db } from "../firebase/config";
import { classEventsApi, timetableApi } from "../lib/api";

const DAYS = [
  { id: 1, short: "Mon", label: "Monday" },
  { id: 2, short: "Tue", label: "Tuesday" },
  { id: 3, short: "Wed", label: "Wednesday" },
  { id: 4, short: "Thu", label: "Thursday" },
  { id: 5, short: "Fri", label: "Friday" },
  { id: 6, short: "Sat", label: "Saturday" },
  { id: 0, short: "Sun", label: "Sunday" },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "At start" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
];

const fieldClass =
  "w-full rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none";

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatMonthYear(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function googleCalendarUrl(ev, weekMonday) {
  const dayOffset = ev.dayOfWeek === 0 ? 6 : ev.dayOfWeek - 1;
  const day = addDays(weekMonday, dayOffset);
  const [sh, sm] = (ev.startTime || "09:00").split(":").map(Number);
  const [eh, em] = (ev.endTime || "10:00").split(":").map(Number);
  const start = new Date(day);
  start.setHours(sh, sm || 0, 0, 0);
  const end = new Date(day);
  end.setHours(eh, em || 0, 0, 0);
  const fmt = (dt) =>
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(
      dt.getUTCHours()
    )}${pad(dt.getUTCMinutes())}00Z`;
  const text = encodeURIComponent(ev.title || ev.courseCode || "Class");
  const details = encodeURIComponent(
    [ev.courseCode, ev.location, "Scheduled via UofA Readers"].filter(Boolean).join(" · ")
  );
  const location = encodeURIComponent(ev.location || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(
    start
  )}/${fmt(end)}&details=${details}&location=${location}`;
}

function LockedTimetable({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full overflow-hidden rounded-2xl border border-border-light bg-card-light text-left"
    >
      <div className="pointer-events-none select-none blur-[2px] opacity-40">
        <div className="grid grid-cols-6 gap-2 border-b border-border-light p-4 text-xs font-semibold text-ink-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4].map((r) => (
            <div key={r} className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((c) => (
                <div key={c} className="h-14 rounded-lg bg-surface-light" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px]">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal">
          <Lock size={26} />
        </span>
        <p className="text-base font-semibold text-ink">Timetable is locked</p>
        <p className="mt-1 max-w-xs text-center text-sm text-ink-muted">
          Subscribe to Pro to schedule classes, set reminders, and push to Google Calendar.
        </p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-md">
          <Lock size={14} /> Unlock with Pro
        </span>
      </div>
    </button>
  );
}

const emptyForm = {
  title: "",
  courseId: "",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  reminderMinutes: 15,
  notes: "",
};

export default function StudentTimetable() {
  const { user, profile, authMode } = useAuth();
  const pro = isPro(profile) || profile?.role === "courseRep";
  const { courses } = useCbtData();
  const [gateOpen, setGateOpen] = useState(!pro);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const myCourses = useMemo(() => {
    const ids = profile?.selectedCourseIds || [];
    if (!ids.length) return courses;
    const set = new Set(ids);
    const picked = courses.filter((c) => set.has(c.id));
    return picked.length ? picked : courses;
  }, [courses, profile?.selectedCourseIds]);

  // Personal timetableEvents + Course Rep classEvents
  useEffect(() => {
    if (!user || !pro) {
      setLoading(false);
      return;
    }

    let personal = [];
    let shared = [];

    const merge = () => {
      const weekStart = startOfWeek(weekAnchor);
      const weekEnd = addDays(weekStart, 7);

      const mapped = shared
        .map((ev) => {
          const start = ev.startsAt?.toDate?.() || ev.startsAt;
          const end = ev.endsAt?.toDate?.() || ev.endsAt;
          if (!start) return null;
          const d = new Date(start);
          // Only show events that fall in the visible week
          if (d < weekStart || d >= weekEnd) return null;

          const eh = end ? new Date(end) : null;
          return {
            id: `cr-${ev.id}`,
            title: ev.title || ev.courseCode || "Class",
            courseCode: ev.courseCode || null,
            dayOfWeek: d.getDay(),
            startTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
            endTime: eh
              ? `${pad(eh.getHours())}:${pad(eh.getMinutes())}`
              : null,
            location: ev.venue || null,
            notes: ev.notes || null,
            reminderMinutes: 15,
            reminderEnabled: true,
            source: "courseRep",
            readOnly: true,
          };
        })
        .filter(Boolean);

      const list = [...personal, ...mapped];
      list.sort((a, b) =>
        String(a.startTime || "").localeCompare(String(b.startTime || ""))
      );
      setEvents(list);
      setLoading(false);
    };

    const unsub1 = authMode === "api" ? (() => {
      let cancelled = false;
      Promise.all([timetableApi.list(), classEventsApi.list()]).then(([personalData, sharedData]) => {
        if (cancelled) return;
        personal = (personalData.events || []).map((event) => ({ ...event, source: "personal" }));
        shared = (sharedData.events || []).filter((event) => event.department === (profile?.department || profile?.program));
        merge();
      }).catch(() => setLoading(false));
      return () => { cancelled = true; };
    })() : onSnapshot(
      query(collection(db, "timetableEvents"), where("userId", "==", user.uid)),
      (snap) => {
        personal = snap.docs.map((d) => ({ id: d.id, ...d.data(), source: "personal" }));
        merge();
      },
      () => setLoading(false)
    );

    const unsub2 = authMode === "api" ? () => {} : onSnapshot(
      collection(db, "classEvents"),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const myCodes = new Set(
          (
            profile?.selectedCourseIds?.length
              ? courses
                  .filter((c) => profile.selectedCourseIds.includes(c.id))
                  .map((c) => c.code)
              : courses.map((c) => c.code)
          ).filter(Boolean)
        );

        shared = all.filter((ev) => {
          if (profile?.department && ev.department === profile.department) {
            return true;
          }
          if (ev.courseCode && myCodes.has(ev.courseCode)) return true;
          // Fallback: same faculty
          if (profile?.faculty && ev.faculty === profile.faculty) return true;
          return false;
        });
        merge();
      },
      () => {}
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [
    user,
    authMode,
    pro,
    weekAnchor,
    profile?.department,
    profile?.faculty,
    profile?.selectedCourseIds,
    courses,
  ]);

  // Browser reminders for today's classes
  useEffect(() => {
    if (!pro || notifPerm !== "granted" || !events.length) return undefined;
    const timers = [];
    const now = new Date();
    const todayDow = now.getDay();

    events.forEach((ev) => {
      if (ev.dayOfWeek !== todayDow) return;
      if (ev.reminderMinutes == null || ev.reminderEnabled === false) return;
      const [h, m] = String(ev.startTime || "09:00")
        .split(":")
        .map(Number);
      const start = new Date(now);
      start.setHours(h, m || 0, 0, 0);
      const fireAt =
        start.getTime() - (Number(ev.reminderMinutes) || 0) * 60 * 1000;
      const delay = fireAt - Date.now();
      if (delay < 0 || delay > 24 * 60 * 60 * 1000) return;
      const t = setTimeout(() => {
        try {
          new Notification(ev.title || ev.courseCode || "Class reminder", {
            body: `${ev.startTime}${
              ev.location ? ` · ${ev.location}` : ""
            } — starting soon`,
            tag: `tt-${ev.id}`,
          });
        } catch {
          /* ignore */
        }
      }, delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [events, notifPerm, pro]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekAnchor, i);
      return {
        date,
        dow: date.getDay(),
        label: DAYS.find((d) => d.id === date.getDay())?.short || "",
        isToday: date.toDateString() === new Date().toDateString(),
      };
    });
  }, [weekAnchor]);

  const eventsByDay = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => {
      map[d.id] = [];
    });
    events.forEach((ev) => {
      const k = Number(ev.dayOfWeek);
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    });
    return map;
  }, [events]);

  async function enableReminders() {
    if (typeof Notification === "undefined") {
      alert("Notifications are not supported in this browser.");
      return;
    }
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  }

  function openCreate(dayOfWeek) {
    setEditingId(null);
    setForm({ ...emptyForm, dayOfWeek: dayOfWeek ?? 1 });
    setError("");
    setShowForm(true);
  }

  function openEdit(ev) {
    // Course Rep shared events are read-only
    if (ev.readOnly || ev.source === "courseRep") return;
    setEditingId(ev.id);
    setForm({
      title: ev.title || "",
      courseId: ev.courseId || "",
      courseCode: ev.courseCode || "",
      dayOfWeek: ev.dayOfWeek ?? 1,
      startTime: ev.startTime || "09:00",
      endTime: ev.endTime || "10:00",
      location: ev.location || "",
      reminderMinutes: ev.reminderMinutes ?? 15,
      notes: ev.notes || "",
    });
    setError("");
    setShowForm(true);
  }

  function onCourseChange(courseId) {
    const c = myCourses.find((x) => x.id === courseId);
    setForm((f) => ({
      ...f,
      courseId,
      courseCode: c?.code || "",
      title: f.title || (c ? `${c.code} class` : ""),
    }));
  }

  async function saveEvent(e) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!form.startTime || !form.endTime) {
      setError("Start and end time are required.");
      return;
    }
    if (form.endTime <= form.startTime) {
      setError("End time must be after start time.");
      return;
    }
    setBusy(true);
    const payload = {
      userId: user.uid,
      title: (form.title || form.courseCode || "Class").trim(),
      courseId: form.courseId || null,
      courseCode: form.courseCode || null,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim() || null,
      reminderMinutes: Number(form.reminderMinutes) || 0,
      reminderEnabled: true,
      notes: form.notes.trim() || null,
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingId) {
        if (authMode === "api") await timetableApi.update(editingId, payload);
        else await updateDoc(doc(db, "timetableEvents", editingId), payload);
      } else {
        if (authMode === "api") await timetableApi.create(payload);
        else await addDoc(collection(db, "timetableEvents"), { ...payload, createdAt: serverTimestamp() });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(id) {
    if (String(id).startsWith("cr-")) {
      alert("This class was posted by your Course Rep and can’t be deleted here.");
      return;
    }
    if (!window.confirm("Remove this class from your timetable?")) return;
    try {
      if (authMode === "api") await timetableApi.remove(id);
      else await deleteDoc(doc(db, "timetableEvents", id));
    } catch (err) {
      alert(err.message);
    }
  }

  if (!pro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Timetable</h1>
          <p className="text-sm text-ink-muted">
            Schedule classes, reminders, and Google Calendar.
          </p>
        </div>
        <LockedTimetable onOpen={() => setGateOpen(true)} />
        <SubscribeGateModal
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          feature="Timetable"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Timetable</h1>
          <p className="text-sm text-ink-muted">
            Your classes · Course Rep updates · reminders · Google Calendar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notifPerm !== "granted" ? (
            <button
              type="button"
              onClick={enableReminders}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink hover:bg-surface-light"
            >
              <Bell size={14} /> Enable reminders
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-soft px-3 py-2 text-xs font-medium text-teal">
              <Bell size={14} /> Reminders on
            </span>
          )}
          <button
            type="button"
            onClick={() => openCreate(1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
          >
            <Plus size={14} /> Add class
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-light bg-card-light px-3 py-2">
        <button
          type="button"
          onClick={() => setWeekAnchor((w) => addDays(w, -7))}
          className="rounded-lg p-2 text-ink-muted hover:bg-surface-light hover:text-ink"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            {formatMonthYear(weekAnchor)}
          </p>
          <p className="text-xs text-ink-muted">
            {weekDays[0].date.toLocaleDateString()} –{" "}
            {weekDays[6].date.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekAnchor(startOfWeek(new Date()))}
            className="rounded-lg px-2 py-1 text-xs font-medium text-teal hover:bg-teal-soft"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor((w) => addDays(w, 7))}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-light hover:text-ink"
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading schedule…</p>}

      <div className="overflow-x-auto rounded-2xl border border-border-light bg-card-light">
        <div className="grid min-w-[720px] grid-cols-7 divide-x divide-border-light">
          {weekDays.map((col) => (
            <div key={col.date.toISOString()} className="min-h-[220px]">
              <button
                type="button"
                onClick={() => openCreate(col.dow)}
                className={`flex w-full flex-col items-center border-b border-border-light px-1 py-2 hover:bg-surface-light ${
                  col.isToday ? "bg-teal-soft/50" : ""
                }`}
              >
                <span className="text-[11px] font-medium text-ink-muted">
                  {col.label}
                </span>
                <span
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    col.isToday ? "bg-teal text-white" : "text-ink"
                  }`}
                >
                  {col.date.getDate()}
                </span>
              </button>
              <div className="space-y-1.5 p-1.5">
                {(eventsByDay[col.dow] || []).map((ev) => {
                  const isRep = ev.source === "courseRep" || ev.readOnly;
                  return (
                    <div
                      key={ev.id}
                      className={`group rounded-lg border p-1.5 text-left ${
                        isRep
                          ? "border-amber-200 bg-amber-50"
                          : "border-teal/20 bg-teal-soft/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openEdit(ev)}
                        className="w-full text-left"
                      >
                        <p
                          className={`truncate text-[11px] font-bold ${
                            isRep ? "text-amber-700" : "text-teal"
                          }`}
                        >
                          {ev.courseCode || "Class"}
                          {isRep ? " · Rep" : ""}
                        </p>
                        <p className="truncate text-[10px] text-ink">{ev.title}</p>
                        <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-ink-muted">
                          <Clock size={10} />
                          {ev.startTime}
                          {ev.endTime ? `–${ev.endTime}` : ""}
                        </p>
                      </button>
                      <div className="mt-1 flex gap-1 opacity-80">
                        <a
                          href={googleCalendarUrl(ev, weekAnchor)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-0.5 text-ink-muted hover:text-teal"
                          title="Add to Google Calendar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                        </a>
                        {!isRep && (
                          <button
                            type="button"
                            onClick={() => removeEvent(ev.id)}
                            className="rounded p-0.5 text-ink-muted hover:text-status-danger"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!eventsByDay[col.dow]?.length && (
                  <button
                    type="button"
                    onClick={() => openCreate(col.dow)}
                    className="flex w-full items-center justify-center rounded-lg border border-dashed border-border-light py-4 text-ink-muted hover:border-teal/40 hover:text-teal"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Amber cards are classes posted by a Course Rep (read-only). Teal cards are
        your own. Enable browser reminders for same-day alerts while this tab is
        open.
      </p>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setShowForm(false)}
          />
          <form
            onSubmit={saveEvent}
            className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-light bg-card-light p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                {editingId ? "Edit class" : "Schedule class"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Course</label>
                <select
                  value={form.courseId}
                  onChange={(e) => onCourseChange(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select course (optional)</option>
                  {myCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Title</label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={fieldClass}
                  placeholder="e.g. CSC 101 Lecture"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Day</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dayOfWeek: Number(e.target.value),
                    }))
                  }
                  className={fieldClass}
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Start</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">End</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    className={fieldClass}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-ink-muted">
                  <MapPin size={12} /> Venue / location
                </label>
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className={fieldClass}
                  placeholder="e.g. LT1, Faculty block"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">
                  Reminder
                </label>
                <select
                  value={form.reminderMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reminderMinutes: Number(e.target.value),
                    }))
                  }
                  className={fieldClass}
                >
                  {REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className={fieldClass}
                  placeholder="Optional"
                />
              </div>
              {error && <p className="text-sm text-status-danger">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-teal py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
              >
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Update class"
                    : "Save to timetable"}
              </button>
              {editingId && (
                <a
                  href={googleCalendarUrl(
                    { ...form, courseCode: form.courseCode },
                    weekAnchor
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-light py-2.5 text-sm font-medium text-ink hover:bg-surface-light"
                >
                  <ExternalLink size={14} /> Add this class to Google Calendar
                </a>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}