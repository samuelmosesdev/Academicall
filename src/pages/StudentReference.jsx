import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { BookMarked, Calendar } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { classEventsApi } from "../lib/api";

/**
 * Reference page: classEvents for the student's faculty/department/courses
 * + optional referenceItems collection.
 */
export default function StudentReference() {
  const { profile, authMode } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      classEventsApi.list().then(({ events = [] }) => {
        if (!alive) return;
        setEvents(events.filter((event) => !profile?.department || event.department === profile.department));
      }).catch(() => alive && setEvents([])).finally(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    // Prefer filtering by department when set; otherwise show recent global events
    let q;
    if (profile?.department) {
      q = query(
        collection(db, "classEvents"),
        where("department", "==", profile.department),
        orderBy("startsAt", "desc"),
        limit(100)
      );
    } else {
      q = query(
        collection(db, "classEvents"),
        orderBy("startsAt", "desc"),
        limit(100)
      );
    }

    // Firestore ignores an error callback's return value — the fallback used to
    // leak a live, unbounded listener on the whole classEvents collection.
    let fallbackUnsub = null;

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        // Fallback without composite index: department filter only, no orderBy
        const fallbackQ = profile?.department
          ? query(
              collection(db, "classEvents"),
              where("department", "==", profile.department),
              limit(100)
            )
          : query(collection(db, "classEvents"), limit(100));

        fallbackUnsub?.();
        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
              const ta = a.startsAt?.toDate?.() || a.startsAt || 0;
              const tb = b.startsAt?.toDate?.() || b.startsAt || 0;
              return new Date(tb) - new Date(ta);
            });
            setEvents(list);
            setLoading(false);
          },
          () => setLoading(false)
        );
      }
    );
    return () => {
      unsub();
      fallbackUnsub?.();
    };
  }, [profile?.department, authMode]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      const t = e.startsAt?.toDate?.() || e.startsAt;
      return t && new Date(t).getTime() >= now - 86400000;
    });
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Reference</h1>
        <p className="text-sm text-ink-muted">
          Lecture updates and class schedules from your Course Reps.
        </p>
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading…</p>}

      {!loading && upcoming.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-light bg-card-light p-10 text-center text-sm text-ink-muted">
          <BookMarked size={28} className="mx-auto mb-2 opacity-50" />
          No class references yet.
        </div>
      )}

      <div className="space-y-3">
        {upcoming.map((e) => {
          const start = e.startsAt?.toDate?.() || e.startsAt;
          return (
            <div
              key={e.id}
              className="rounded-2xl border border-border-light bg-card-light p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-teal-soft px-1.5 py-0.5 text-[11px] font-bold text-teal">
                  {e.courseCode}
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  <Calendar size={12} />
                  {start ? new Date(start).toLocaleString() : "—"}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-ink">{e.title}</h3>
              {e.venue && (
                <p className="mt-1 text-xs text-ink-muted">Venue: {e.venue}</p>
              )}
              {e.notes && (
                <p className="mt-2 text-sm text-ink-muted whitespace-pre-wrap">
                  {e.notes}
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-muted">
                Posted by {e.createdByName || "Course Rep"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
