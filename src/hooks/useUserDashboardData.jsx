import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  coursesApi,
  enrollmentsApi,
  notificationsApi,
  STUDENT_NOTIFICATIONS_UPDATED_EVENT,
} from "../lib/api";
import { subscribe as subscribeRealtime } from "../lib/realtime";

const EMPTY = {
  profile: null,
  kpis: { coursesEnrolled: 0, questionsPracticed: 0, studyStreakDays: 0, materialsOpened: 0, avgProgress: 0, plan: "Free", isPaid: false },
  enrollments: [],
  allEnrollments: [],
  recommended: [],
  unreadCount: 0,
  loading: true,
  refresh: () => Promise.resolve(),
};

/** How often the dashboard quietly re-checks, while the tab is visible. */
const PROFILE_POLL_MS = 30_000;
const DATA_POLL_MS = 90_000;
/** Focus + visibility fire together; never refresh twice within this window. */
const MIN_GAP_MS = 8_000;

const UserDashboardDataContext = createContext(EMPTY);

const signatureOf = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Math.random()); // unserialisable: treat as changed
  }
};

const tabIsVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

/**
 * Student dashboard data, refreshed in the background without any visual noise:
 *
 *  - `loading` is true ONLY for the very first load (and when the account changes).
 *    Background refreshes never flip it, so skeletons / "--" placeholders never reappear.
 *  - Every background result is compared with what is already on screen. If nothing
 *    changed, no state is touched, so nothing re-renders. If something changed, only
 *    that slice updates and the UI settles into it.
 *  - Failed background refreshes are ignored; the last good data stays on screen.
 *  - Polling pauses while the tab is hidden and catches up when it becomes visible.
 */
export function UserDashboardDataProvider({ children }) {
  const { user, profile, loading: authLoading, authMode, refreshProfile } = useAuth();
  const uid = user?.uid || null;
  const activeUid = useRef(uid);
  activeUid.current = uid;
  const [enrollments, setEnrollments] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unreadRequestId = useRef(0);
  const signatures = useRef({ enrollments: "", courses: "" });
  const lastDataRefresh = useRef(0);
  const inflight = useRef(null);

  const refreshUnreadCount = useCallback(async () => {
    const requestId = ++unreadRequestId.current;
    if (!uid || authMode !== "api") {
      setUnreadCount(0);
      return;
    }
    const { notifications = [] } = await notificationsApi.list();
    if (requestId === unreadRequestId.current) {
      setUnreadCount(notifications.filter((item) => item.readByUser !== true).length);
    }
  }, [uid, authMode]);

  /** Fetch enrollments + courses and apply only the parts that changed. */
  const loadCollections = useCallback(() => {
    // One request at a time: overlapping callers share the same in-flight fetch.
    if (inflight.current) return inflight.current;
    lastDataRefresh.current = Date.now();
    const requestUid = uid;
    const request = Promise.all([enrollmentsApi.list(), coursesApi.list()])
      .then(([enrollmentData, courseData]) => {
        if (activeUid.current !== requestUid) return;
        const list = enrollmentData.enrollments || [];
        const courses = courseData.courses || [];
        const enrollmentSig = signatureOf(list);
        const courseSig = signatureOf(courses);
        if (enrollmentSig !== signatures.current.enrollments) {
          signatures.current.enrollments = enrollmentSig;
          setAllEnrollments(list);
          setEnrollments(list.slice(0, 5));
        }
        if (courseSig !== signatures.current.courses) {
          signatures.current.courses = courseSig;
          setRecommended(courses);
        }
      })
      .finally(() => {
        if (inflight.current === request) inflight.current = null;
      });
    inflight.current = request;
    return request;
  }, [uid]);

  /**
   * Public, silent refresh (pages call it when they mount). Skipped if the data
   * was fetched a moment ago, so arriving on a page never triggers a duplicate load.
   */
  const refresh = useCallback(async () => {
    if (!uid || authMode !== "api") return;
    if (Date.now() - lastDataRefresh.current < MIN_GAP_MS) return;
    const jobs = [
      ["enrollments and courses", loadCollections()],
      ["profile", refreshProfile()],
      ["notification count", refreshUnreadCount()],
    ];
    const results = await Promise.allSettled(jobs.map(([, request]) => request));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Failed to refresh student dashboard ${jobs[index][0]}`, result.reason);
      }
    });
  }, [uid, authMode, loadCollections, refreshProfile, refreshUnreadCount]);

  // First load (and account switches). The only place `loading` is ever set.
  useEffect(() => {
    signatures.current = { enrollments: "", courses: "" };
    inflight.current = null;
    lastDataRefresh.current = 0;
    unreadRequestId.current += 1;
    setEnrollments([]);
    setAllEnrollments([]);
    setRecommended([]);
    setUnreadCount(0);
    if (!uid || authMode !== "api") {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    loadCollections()
      .catch((error) => console.error("Failed to load student dashboard collections", error))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [uid, authMode, loadCollections]);

  // Notification badge: refresh on events / focus / live stream. Never resets to 0.
  useEffect(() => {
    if (authMode !== "api" || !uid) return undefined;
    const refreshBadge = () => {
      refreshUnreadCount().catch((error) => {
        console.error("Failed to refresh student notification count", error);
      });
    };
    refreshBadge();
    window.addEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refreshBadge);
    window.addEventListener("focus", refreshBadge);
    // House posts, mentions and followed news arrive over the live stream.
    const off = subscribeRealtime("notification", () => {
      refreshBadge();
      window.dispatchEvent(new Event(STUDENT_NOTIFICATIONS_UPDATED_EVENT));
    });
    return () => {
      window.removeEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refreshBadge);
      window.removeEventListener("focus", refreshBadge);
      off?.();
    };
  }, [authMode, uid, refreshUnreadCount]);

  // Quiet background polling for the profile (streak, counters, plan) and the lists.
  useEffect(() => {
    if (authMode !== "api" || !uid) return undefined;
    let lastProfile = 0;
    const refreshProfileQuietly = (force = false) => {
      if (!tabIsVisible()) return;
      const now = Date.now();
      if (!force && now - lastProfile < MIN_GAP_MS) return;
      lastProfile = now;
      refreshProfile().catch((error) => {
        console.error("Failed to refresh student profile", error);
      });
    };
    const refreshDataQuietly = () => {
      if (!tabIsVisible()) return;
      if (Date.now() - lastDataRefresh.current < MIN_GAP_MS) return;
      lastDataRefresh.current = Date.now();
      loadCollections().catch((error) => {
        console.error("Failed to refresh student dashboard collections", error);
      });
    };
    const onActivity = () => refreshProfileQuietly(true);
    const onWake = () => {
      refreshProfileQuietly();
      refreshDataQuietly();
    };
    window.addEventListener("student-activity-updated", onActivity);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    const profileTimer = setInterval(() => refreshProfileQuietly(true), PROFILE_POLL_MS);
    const dataTimer = setInterval(refreshDataQuietly, DATA_POLL_MS);
    return () => {
      window.removeEventListener("student-activity-updated", onActivity);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      clearInterval(profileTimer);
      clearInterval(dataTimer);
    };
  }, [authMode, uid, refreshProfile, loadCollections]);

  const kpis = useMemo(() => {
    const observedCourseCount = allEnrollments.length || Number(profile?.coursesEnrolledCount) || 0;
    const questionsPracticed = Number(profile?.questionsPracticedCount ?? 0);
    const studyStreakDays = Number(profile?.studyStreakDays ?? 0);
    const materialsOpened = Number(profile?.materialsOpenedCount ?? 0);
    const avgProgress = allEnrollments.length
      ? Math.round(allEnrollments.reduce((sum, item) => sum + (Number(item.progressPct) || 0), 0) / allEnrollments.length)
      : 0;
    const plan = profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro" ? "Pro" : "Free";
    return {
      coursesEnrolled: observedCourseCount,
      questionsPracticed,
      studyStreakDays,
      materialsOpened,
      avgProgress,
      plan,
      isPaid: plan === "Pro",
    };
  }, [allEnrollments, profile]);

  const value = useMemo(() => ({
    profile, kpis, enrollments, allEnrollments, recommended, unreadCount,
    loading: authLoading || loading,
    refresh,
  }), [profile, kpis, enrollments, allEnrollments, recommended, unreadCount, authLoading, loading, refresh]);

  return <UserDashboardDataContext.Provider value={value}>{children}</UserDashboardDataContext.Provider>;
}

export function useUserDashboardData() {
  return useContext(UserDashboardDataContext);
}
