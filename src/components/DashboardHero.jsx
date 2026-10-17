import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, Clock, BellRing } from "lucide-react";
import DashboardBoard from "./board/DashboardBoard";
import { classEventsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getAcademicScope, matchesAcademicScope } from "../lib/academicScope";
import { institutionLabel } from "../hooks/useInstitutions";

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const normalizeLevel = (value) => String(value || "").trim().toLowerCase().replace(/\s*level\s*/g, "");

function countdown(date, now) {
  const t = date - now;
  if (t <= 0) return "Happening now";
  const d = Math.floor(t / 864e5), h = Math.floor((t % 864e5) / 36e5), m = Math.floor((t % 36e5) / 6e4);
  return d ? `in ${d}d ${h}h` : h ? `in ${h}h ${m}m` : `in ${m} min`;
}

/**
 * Dashboard opener: the curated board on the left (messages, images or slides chosen by
 * admins / agents with the "Dashboard board" permission) and a slimmer lemon
 * "Lecture update" card on the right: next lecture + recent changes.
 */
export default function DashboardHero({ profile, firstName }) {
  const navigate = useNavigate();
  const { authMode } = useAuth();
  const program = getAcademicScope(profile);
  const level = profile?.level || "";
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (authMode !== "api" || !program) {
      setEvents([]);
      setEventsError("");
      setEventsLoading(false);
      return undefined;
    }

    let alive = true;
    setEvents([]);
    setEventsError("");
    setEventsLoading(true);
    classEventsApi
      .list()
      .then(({ events: list = [] }) => {
        if (!alive) return;
        setEvents(list.filter((event) =>
          matchesAcademicScope(event.program || event.department, profile) &&
          normalizeLevel(event.level) === normalizeLevel(level) &&
          normalizeLevel(level)
        ));
      })
      .catch((err) => {
        if (!alive) return;
        console.error("Could not load the student's class schedule:", err);
        setEventsError("We couldn't load your class schedule. Check your connection and try again.");
      })
      .finally(() => {
        if (alive) setEventsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [authMode, profile, program, level, reloadKey]);

  const { next, todayCount } = useMemo(() => {
    const currentTime = new Date(now);
    const upcoming = events
      .map((e) => ({ ...e, start: toDate(e.startsAt) }))
      .filter((e) => e.start > currentTime && e.status !== "cancelled")
      .sort((a, b) => a.start - b.start);
    return {
      next: upcoming[0] || null,
      todayCount: upcoming.filter((e) => e.start.toDateString() === currentTime.toDateString()).length,
    };
  }, [events, now]);

  const recentUpdates = useMemo(() => {
    const cutoff = now - 4 * 864e5;
    return events
      .map((e) => ({ ...e, start: toDate(e.startsAt), updated: toDate(e.updatedAt) || toDate(e.createdAt), created: toDate(e.createdAt) }))
      .filter((e) => e.updated && e.updated.getTime() > cutoff && e.id !== next?.id)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 3);
  }, [events, now, next?.id]);

  const institution = institutionLabel(profile?.institution) || (profile?.institutionId === "uofa" ? "University of Abuja" : "Institution not set");
  const levelLabel = level ? `${String(level).replace(/\s*level\s*$/i, "").trim()} Level` : null;
  const meta = [program || profile?.faculty, levelLabel].filter(Boolean).join(" · ");
  const timeFmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayFmt = (d) => d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const nextLine = next
    ? `Your next class is ${next.courseCode || next.title} on ${dayFmt(next.start)} at ${timeFmt(next.start)}.${todayCount > 1 ? ` You have ${todayCount} classes scheduled today.` : ""}`
    : "No upcoming classes are scheduled for your programme yet. When your Course Rep adds one, it shows up here.";

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,0.85fr)]">
      <DashboardBoard profile={profile} firstName={firstName} institution={institution} meta={meta} nextLine={nextLine} />

      {/* Lecture update: the next class, then what changed recently */}
      <div className="flex flex-col rounded-[1.6rem] bg-lemon p-5 text-midnight sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow inline-flex items-center gap-1.5 text-midnight/65"><BellRing size={13} /> Lecture update</span>
          {next && <span className="eyebrow rounded-full bg-midnight px-2.5 py-1 text-[0.7rem] text-lemon">{countdown(next.start, now)}</span>}
        </div>
        {eventsError ? (
          <div role="alert" className="mt-5">
            <p className="font-display text-[1.2rem] font-[380] leading-snug">Schedule unavailable</p>
            <p className="mt-1.5 text-sm text-midnight/70">{eventsError}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-3 inline-flex rounded-full bg-midnight px-4 py-2 text-sm font-medium text-lemon transition hover:brightness-125">Try again</button>
          </div>
        ) : eventsLoading ? (
          <p role="status" className="mt-5 font-display text-[1.1rem] font-[380]">Checking your lectures…</p>
        ) : (
          <>
            {next ? (
              <button type="button" onClick={() => navigate("/dashboard/department")} className="group mt-4 w-full rounded-2xl bg-white/55 p-4 text-left transition hover:bg-white/75">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-midnight/55">Next lecture</p>
                <p className="mt-1 font-display text-[1.55rem] font-[420] leading-none tracking-[-0.02em]">{next.courseCode || "Class"}</p>
                <p className="mt-1 line-clamp-1 text-[0.9rem] text-midnight/75">{next.title}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-midnight/75">
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> {dayFmt(next.start)} · {timeFmt(next.start)}</span>
                  {next.venue && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {next.venue}</span>}
                </div>
              </button>
            ) : (
              <p className="mt-4 font-display text-[1.15rem] font-[380] leading-snug">No lectures scheduled yet. Your Course Rep's updates land here.</p>
            )}
            <div className="mt-4 flex-1">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-midnight/55">Latest changes</p>
              {recentUpdates.length === 0 ? (
                <p className="mt-1.5 text-[0.82rem] text-midnight/65">Nothing new in the last few days.</p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {recentUpdates.map((e) => {
                    const isNew = e.created && e.updated && Math.abs(e.updated - e.created) < 60_000;
                    return (
                      <li key={e.id} className="flex items-start gap-2 text-[0.82rem] leading-snug">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isNew ? "bg-violet" : "bg-midnight"}`} />
                        <span className="min-w-0">
                          <span className="font-semibold">{e.courseCode || e.title}</span>{" "}
                          <span className="text-midnight/70">{isNew ? "added" : "updated"} · {e.start ? `${dayFmt(e.start)}, ${timeFmt(e.start)}` : ""}{e.venue ? ` · ${e.venue}` : ""}</span>
                          {e.notes && <span className="block truncate text-[0.76rem] text-midnight/60">{e.notes}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => navigate("/dashboard/department")} className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-midnight px-4 py-2 text-[0.82rem] font-medium text-lemon transition hover:brightness-125">
              All lecture updates <ArrowRight size={14} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
