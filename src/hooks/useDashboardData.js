import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usersApi, documentsApi, activityApi, subscriptionsApi } from "../lib/api";

/**
 * Live admin dashboard data.
 *
 * Every value here is driven by Firestore `onSnapshot` listeners, so the
 * dashboard re-renders automatically the moment a document is added,
 * edited, or removed in Firestore -- no page refresh, no static numbers.
 *
 * Firestore collections expected:
 *  - users            { name, email, role, plan: 'free' | 'annual', createdAt }
 *  - agents           { name, email, status: 'active' | 'inactive', createdAt }
 *  - documents        { title, uploadedBy, createdAt }
 *  - subscriptions    { userId, status: 'active' | 'expired', plan, startedAt }
 *  - activityLog      { userName, avatarUrl, action, detail, status, createdAt }
 */
export function useDashboardData() {
  const { authMode } = useAuth();
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadApi = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userResult, documentResult, activityResult, subscriptionResult] =
        await Promise.allSettled([
          usersApi.list(),
          documentsApi.list(),
          activityApi.list("limit=6"),
          subscriptionsApi.count(),
        ]);

      if (userResult.status === "rejected") throw userResult.reason;

      const userData = userResult.value;
      const documentData = documentResult.status === "fulfilled" ? documentResult.value : {};
      const activityData = activityResult.status === "fulfilled" ? activityResult.value : {};
      const subscriptionData = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : {};
      const userList = userData.users || [];
      setUsers(userList);
      setAgents(userList.filter((user) => ["agent", "alphaAgent"].includes(user.role)));
      setDocumentsCount((documentData.documents || []).length);
      setRecentActivity(activityData.activities || activityData.activity || []);
      setActiveSubscriptions(subscriptionData.count || 0);
    } catch (err) {
      console.error("[useDashboardData] API load failed:", err);
      setUsers([]);
      setAgents([]);
      setDocumentsCount(0);
      setRecentActivity([]);
      setActiveSubscriptions(0);
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authMode !== "api") return undefined;

    loadApi();
    return undefined;
  }, [authMode, loadApi]);

  const kpis = useMemo(() => {
    const activeAgents = agents.filter((a) => a.status === "active").length;
    return {
      totalUsers: users.length,
      activeAgents,
      documentsUploaded: documentsCount,
      activeSubscriptions,
    };
  }, [users, agents, documentsCount, activeSubscriptions]);

  const freeVsPaid = useMemo(() => {
    const paid = users.filter((u) => u.plan === "annual").length;
    const free = users.length - paid;
    const total = users.length || 1;
    return {
      paid,
      free,
      paidPct: Math.round((paid / total) * 100),
      freePct: Math.round((free / total) * 100),
    };
  }, [users]);

  const userGrowth = useMemo(() => {
    // Group signups by month for the last 12 months into a running total.
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("default", { month: "short" }), count: 0 };
    });
    const indexByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));

    users.forEach((u) => {
      const created = u.createdAt?.toDate ? u.createdAt.toDate() : u.createdAt ? new Date(u.createdAt) : null;
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      if (key in indexByKey) months[indexByKey[key]].count += 1;
    });

    let running = 0;
    return months.map((m) => {
      running += m.count;
      return { label: m.label, users: running };
    });
  }, [users]);

  return { kpis, freeVsPaid, userGrowth, recentActivity, loading, error, retry: loadApi };
}
