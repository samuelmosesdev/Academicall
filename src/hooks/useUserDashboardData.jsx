import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  coursesApi,
  enrollmentsApi,
  notificationsApi,
  STUDENT_NOTIFICATIONS_UPDATED_EVENT,
} from "../lib/api";

const EMPTY = {
  profile: null,
  kpis: { coursesEnrolled: 0, questionsPracticed: 0, studyStreakDays: 0, materialsOpened: 0, avgProgress: 0, plan: "Free", isPaid: false },
  enrollments: [],
  allEnrollments: [],
  recommended: [],
  unreadCount: 0,
  loading: true,
};

const UserDashboardDataContext = createContext(EMPTY);

export function UserDashboardDataProvider({ children }) {
  const { user, profile, loading: authLoading, authMode, refreshProfile } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unreadRequestId = useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    const requestId = ++unreadRequestId.current;
    if (!user || authMode !== "api") {
      setUnreadCount(0);
      return;
    }
    const { notifications = [] } = await notificationsApi.list();
    if (requestId === unreadRequestId.current) {
      setUnreadCount(notifications.filter((item) => item.readByUser !== true).length);
    }
  }, [user, authMode]);

  useEffect(() => {
    if (!user || authMode !== "api") {
      unreadRequestId.current += 1;
      setEnrollments([]);
      setAllEnrollments([]);
      setRecommended([]);
      setUnreadCount(0);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setUnreadCount(0);
    Promise.all([enrollmentsApi.list(), coursesApi.list()])
      .then(([enrollmentData, courseData]) => {
        if (!alive) return;
        const list = enrollmentData.enrollments || [];
        setAllEnrollments(list);
        setEnrollments(list.slice(0, 5));
        setRecommended(courseData.courses || []);
      })
      .catch(() => alive && setLoading(false))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user, authMode]);

  useEffect(() => {
    if (authMode !== "api" || !user) return undefined;
    const refresh = () => {
      refreshUnreadCount().catch((error) => {
        console.error("Failed to refresh student notification count", error);
      });
    };
    refresh();
    window.addEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(STUDENT_NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [authMode, user, refreshUnreadCount]);

  useEffect(() => {
    if (authMode !== "api" || !user) return undefined;
    const refresh = () => refreshProfile().catch(() => {});
    window.addEventListener("student-activity-updated", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("student-activity-updated", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [authMode, user, refreshProfile]);

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
  }), [profile, kpis, enrollments, allEnrollments, recommended, unreadCount, authLoading, loading]);

  return <UserDashboardDataContext.Provider value={value}>{children}</UserDashboardDataContext.Provider>;
}

export function useUserDashboardData() {
  return useContext(UserDashboardDataContext);
}
