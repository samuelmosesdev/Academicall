import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestsApi, paymentsApi } from "../lib/api";
import { can } from "../lib/roles";

/**
 * "Waiting on you" counters for the staff dashboards. Each count is only requested
 * if the person holds the matching review permission (admins hold all of them), and a
 * failed request just leaves that counter out instead of breaking the dashboard.
 *
 *   requests -> pending requests        payments -> claims awaiting review
 */
export function useStaffQueues() {
  const { profile, authMode } = useAuth();
  const [state, setState] = useState({ requests: null, payments: null, loading: true });
  const canRequests = can(profile, "requests.review");
  const canPayments = can(profile, "payments.review");

  useEffect(() => {
    if (authMode !== "api") return undefined;
    let alive = true;
    Promise.allSettled([
      canRequests ? requestsApi.list() : Promise.resolve(null),
      canPayments ? paymentsApi.listClaims() : Promise.resolve(null),
    ]).then(([requests, claims]) => {
      if (!alive) return;
      if (requests.status === "rejected") {
        console.error("Failed to load staff request queue", requests.reason);
      }
      if (claims.status === "rejected") {
        console.error("Failed to load staff payment queue", claims.reason);
      }
      const ok = (r) => r.status === "fulfilled" && r.value;
      setState({
        requests: ok(requests) ? (requests.value.requests || []).filter((r) => r.status === "pending").length : null,
        payments: ok(claims) ? (claims.value.claims || []).filter((c) => c.status === "awaiting_review").length : null,
        loading: false,
      });
    });
    return () => { alive = false; };
  }, [authMode, canRequests, canPayments]);

  return state;
}
