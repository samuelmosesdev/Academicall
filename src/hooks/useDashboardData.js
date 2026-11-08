import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usersApi, documentsApi, activityApi, subscriptionsApi } from "../lib/api";

/**
 * Live admin dashboard data.
 *
 * Uses API totals for user counts and growth, independent of the directory page limit.
 * Failures are shown on the dashboard with a retry action.
 */
export function useDashboardData() {
  const { authMode } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [pendingDocuments, setPendingDocuments] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadApi = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userResult, statsResult, documentResult, activityResult, subscriptionResult] =
        await Promise.allSettled([
          usersApi.list(),
          usersApi.stats(),
          documentsApi.list(),
          activityApi.list("limit=6"),
          subscriptionsApi.count(),
        ]);
      if (userResult.status === "rejected" && statsResult.status === "rejected") {
        throw userResult.reason || statsResult.reason;
      }

      const userData = userResult.status === "fulfilled" ? userResult.value : { users: [] };
      const statsData = statsResult.status === "fulfilled" ? statsResult.value : null;
      const documentData = documentResult.status === "fulfilled" ? documentResult.value : {};
      const activityData = activityResult.status === "fulfilled" ? activityResult.value : {};
      const subscriptionData = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : {};
      for (const [label, result] of [
        ["user directory", userResult],
        ["dashboard totals", statsResult],
        ["documents", documentResult],
        ["activity", activityResult],
        ["subscriptions", subscriptionResult],
      ]) {
        if (result.status === "rejected" && (label === "user directory" || label === "dashboard totals"
          ? userResult.status === "fulfilled" || statsResult.status === "fulfilled"
          : true)) {
          console.error(`Failed to load admin dashboard ${label}`, result.reason);
        }
      }
      const userList = userData.users || [];
      setUsers(userList);
      setStats(statsData);
      setAgents(userList.filter((user) => ["agent", "alphaAgent"].includes(user.role)));
      setDocumentsCount((documentData.documents || []).length);
      setPendingDocuments((documentData.documents || []).filter((d) => d.status === "pending").length);
      setRecentActivity(activityData.activities || activityData.activity || []);
      setActiveSubscriptions(subscriptionData.count || 0);
    } catch (err) {
      console.error("[useDashboardData] API load failed:", err);
      setUsers([]);
      setStats(null);
      setAgents([]);
      setDocumentsCount(0);
      setPendingDocuments(0);
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
      totalUsers: stats?.total ?? users.length,
      activeAgents,
      documentsUploaded: documentsCount,
      activeSubscriptions,
    };
  }, [users, agents, documentsCount, activeSubscriptions, stats]);

  const freeVsPaid = useMemo(() => {
    if (stats) {
      const paid = stats.paid ?? ((stats.pro || 0) + (stats.annual || 0));
      const free = stats.free ?? Math.max(0, (stats.total || 0) - paid);
      const total = stats.total || free + paid || 1;
      return {
        paid,
        free,
        paidPct: Math.round((paid / total) * 100),
        freePct: Math.round((free / total) * 100),
      };
    }
    const paid = users.filter((u) => u.plan === "annual" || u.plan === "pro").length;
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
    if (stats?.growth) return stats.growth;
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
  }, [users, stats, stats?.total, stats?.paid, stats?.free, stats?.pro, stats?.annual]);

  return { kpis, freeVsPaid, userGrowth, recentActivity, pendingDocuments, loading, error, retry: loadApi };
}
