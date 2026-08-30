import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { coursesApi, enrollmentsApi, notificationsApi } from "../lib/api";

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
  const { user, profile, loading: authLoading, authMode } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || authMode !== "api") {
      setEnrollments([]);
      setAllEnrollments([]);
      setRecommended([]);
      setUnreadCount(0);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    Promise.all([enrollmentsApi.list(), coursesApi.list(), notificationsApi.list()])
      .then(([enrollmentData, courseData, notificationData]) => {
        if (!alive) return;
        const list = enrollmentData.enrollments || [];
        setAllEnrollments(list);
        setEnrollments(list.slice(0, 5));
        setRecommended(courseData.courses || []);
        setUnreadCount((notificationData.notifications || []).filter((item) => !item.readByUser).length);
      })
      .catch(() => alive && setLoading(false))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user, authMode]);

  const kpis = useMemo(() => {
    const avgProgress = allEnrollments.length
      ? Math.round(allEnrollments.reduce((sum, item) => sum + (Number(item.progressPct) || 0), 0) / allEnrollments.length)
      : 0;
    const plan = profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro" ? "Pro" : "Free";
    return {
      coursesEnrolled: allEnrollments.length || profile?.coursesEnrolledCount || 0,
      questionsPracticed: profile?.questionsPracticedCount || 0,
      studyStreakDays: profile?.studyStreakDays || 0,
      materialsOpened: profile?.materialsOpenedCount || 0,
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
