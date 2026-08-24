import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

/**
 * Live student dashboard data from Firestore.
 * KPIs are derived from real enrollments + profile counters so figures stay accurate.
 *
 * IMPORTANT: consume this through `useUserDashboardData()`, which reads the
 * context published by `<UserDashboardDataProvider>` in UserLayout. Calling the
 * subscribing hook directly from more than one component mounts a second,
 * independent set of listeners and bills every read twice — which is exactly
 * what UserLayout + UserDashboard used to do.
 */
function useUserDashboardDataSource() {
  const { user, profile, loading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Recent for "continue studying"
    const recentQ = query(
      collection(db, "enrollments"),
      where("userId", "==", user.uid),
      orderBy("lastAccessedAt", "desc"),
      limit(5)
    );
    // Firestore ignores an error callback's return value, so the fallback
    // listener that used to be `return`ed from here was never unsubscribed —
    // one permanently-live listener leaked per mount.
    let fallbackUnsub = null;

    const unsubRecent = onSnapshot(
      recentQ,
      (snap) => {
        setEnrollments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        // Fallback without orderBy if index missing
        const simple = query(
          collection(db, "enrollments"),
          where("userId", "==", user.uid),
          limit(50)
        );
        fallbackUnsub?.();
        fallbackUnsub = onSnapshot(simple, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const ta = a.lastAccessedAt?.toMillis?.() || 0;
            const tb = b.lastAccessedAt?.toMillis?.() || 0;
            return tb - ta;
          });
          setEnrollments(list.slice(0, 5));
          setAllEnrollments(list);
          setLoading(false);
        });
      }
    );

    // All enrollments for accurate KPI count
    const allQ = query(
      collection(db, "enrollments"),
      where("userId", "==", user.uid),
      limit(100)
    );
    const unsubAll = onSnapshot(allQ, (snap) => {
      setAllEnrollments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const recQuery = query(collection(db, "courses"), limit(12));
    const unsubRec = onSnapshot(recQuery, (snap) => {
      setRecommended(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("readByUser", "==", false),
      limit(50)
    );
    const unsubNotif = onSnapshot(notifQuery, (snap) => setUnreadCount(snap.size), () => {});

    return () => {
      unsubRecent();
      unsubAll();
      unsubRec();
      unsubNotif();
      fallbackUnsub?.();
    };
  }, [user?.uid]);

  const kpis = useMemo(() => {
    const enrolledCount =
      allEnrollments.length || profile?.coursesEnrolledCount || 0;

    const avgProgress =
      allEnrollments.length > 0
        ? Math.round(
            allEnrollments.reduce((s, e) => s + (Number(e.progressPct) || 0), 0) /
              allEnrollments.length
          )
        : 0;

    const questionsFromEnrollments = allEnrollments.reduce(
      (s, e) => s + (Number(e.questionsDone) || 0),
      0
    );

    return {
      coursesEnrolled: enrolledCount,
      questionsPracticed:
        questionsFromEnrollments || profile?.questionsPracticedCount || 0,
      studyStreakDays: profile?.studyStreakDays ?? 0,
      materialsOpened: profile?.materialsOpenedCount ?? 0,
      avgProgress,
      plan: profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro" ? "Pro" : "Free",
      isPaid: profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro",
    };
  }, [allEnrollments, profile]);

  return useMemo(
    () => ({
      profile,
      kpis,
      enrollments,
      allEnrollments,
      recommended,
      unreadCount,
      loading: authLoading || loading,
    }),
    [profile, kpis, enrollments, allEnrollments, recommended, unreadCount, authLoading, loading]
  );
}

const EMPTY = {
  profile: null,
  kpis: {
    coursesEnrolled: 0,
    questionsPracticed: 0,
    studyStreakDays: 0,
    materialsOpened: 0,
    avgProgress: 0,
    plan: "Free",
    isPaid: false,
  },
  enrollments: [],
  allEnrollments: [],
  recommended: [],
  unreadCount: 0,
  loading: true,
};

const UserDashboardDataContext = createContext(EMPTY);

/** Subscribes once and shares the result with every descendant. */
export function UserDashboardDataProvider({ children }) {
  const value = useUserDashboardDataSource();
  return (
    <UserDashboardDataContext.Provider value={value}>
      {children}
    </UserDashboardDataContext.Provider>
  );
}

export function useUserDashboardData() {
  return useContext(UserDashboardDataContext);
}
