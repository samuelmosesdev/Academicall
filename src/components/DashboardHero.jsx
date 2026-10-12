import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Library, ClipboardCheck, MapPin, Clock } from "lucide-react";
import { classEventsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getAcademicScope, matchesAcademicScope } from "../lib/academicScope";

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const digits = (v) => String(v || "").replace(/\D/g, "");

function countdown(date, now) {
  const t = date - now;
  if (t <= 0) return "Happening now";
  const d = Math.floor(t / 864e5), h = Math.floor((t % 864e5) / 36e5), m = Math.floor((t % 36e5) / 6e4);
  return d ? `in ${d}d ${h}h` : h ? `in ${h}h ${m}m` : `in ${m} min`;
}

/**
 * Dashboard opener: a quiet greeting on the left and the student's next class
 * as a lemon "ticket" on the right. Works without any classes too.
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
        const lvl = digits(level);
        setEvents(list.filter((e) => matchesAcademicScope(e.program || e.department, profile) && (!e.level || digits(e.level) === lvl)));
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
      .map((e) => ({ ...e, start: toDate(e.startsAt), end: toDate(e.endsAt) }))
      .filter((e) => e.start && (e.end || e.start) > currentTime && e.status !== "cancelled")
      .sort((a, b) => a.start - b.start);
    return {
      next: upcoming[0] || null,
      todayCount: upcoming.filter((e) => e.start.toDateString() === currentTime.toDateString()).length,
    };
  }, [events, now]);

  const meta = [program || profile?.faculty, level ? `${level} Level` : null].filter(Boolean).join(" · ");
  const timeFmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayFmt = (d) => d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div className="relative overflow-hidden rounded-[1.6rem] bg-midnight p-7 text-white ring-1 ring-transparent dark:bg-midnight-2 dark:ring-white/10 sm:p-10">
        <img src="/images/campus/library-wide.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[80%_center] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/90 to-midnight/30" />
        <div className="relative">
          <p className="eyebrow text-aqua">{meta || "Complete your profile for a personal feed"}</p>
          <h1 className="mt-5 font-display text-[2.3rem] font-[350] leading-[1.02] tracking-[-0.035em] sm:text-[3rem]">
            Welcome back, <span className="serif-i text-lemon">{firstName}.</span>
          </h1>
          <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-white/65">
            {next
              ? `Your next class is ${next.courseCode || next.title} on ${dayFmt(next.start)} at ${timeFmt(next.start)}.${todayCount > 1 ? ` You have ${todayCount} classes scheduled today.` : ""}`
              : "No upcoming classes are scheduled for your programme yet. When your Course Rep adds one, it will appear here."}
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => navigate("/dashboard/reading-hub")} className="inline-flex items-center gap-2 rounded-full bg-lemon px-5 py-3 text-sm font-semibold text-midnight transition hover:brightness-105">
              <Library size={15} /> Continue reading
            </button>
            <button type="button" onClick={() => navigate("/dashboard/practice")} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              <ClipboardCheck size={15} /> Practice CBT
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[1.6rem] bg-lemon p-7 text-midnight sm:p-8">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-midnight/60">{next ? "Next class" : "Your classes"}</span>
          {next && <span className="eyebrow rounded-full bg-midnight px-2.5 py-1 text-lemon">{countdown(next.start, now)}</span>}
        </div>
        {eventsError ? (
          <div role="alert" className="mt-8">
            <p className="font-display text-[1.4rem] font-[380] leading-snug">Schedule unavailable</p>
            <p className="mt-2 text-sm text-midnight/70">{eventsError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-4 inline-flex rounded-full bg-midnight px-4 py-2 text-sm font-medium text-lemon transition hover:brightness-125"
            >
              Try again
            </button>
          </div>
        ) : eventsLoading ? (
          <p role="status" className="mt-8 font-display text-[1.2rem] font-[380]">
            Checking your upcoming classes…
          </p>
        ) : next ? (
          <button
            type="button"
            onClick={() => navigate("/dashboard/department")}
            className="group mt-8 w-full text-left transition"
          >
            <p className="font-display text-[2rem] font-[420] leading-none tracking-[-0.02em]">{next.courseCode || "Class"}</p>
            <p className="mt-2 text-[1rem] text-midnight/75">{next.title}</p>
            <div className="ticket-rule mt-6" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[0.86rem] text-midnight/75">
              <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {dayFmt(next.start)} · {timeFmt(next.start)}</span>
              {next.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {next.venue}</span>}
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </div>
          </button>
        ) : (
          <div className="mt-8">
            <p className="font-display text-[1.4rem] font-[380] leading-snug">
              When your course rep schedules a class, it appears here with a countdown.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/department")}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-midnight px-4 py-2 text-sm font-medium text-lemon transition hover:brightness-125"
            >
              Visit your department <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
