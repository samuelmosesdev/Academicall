import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Ban, CheckCircle2, KeyRound, ScrollText } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { isAdmin, isAlpha, ROLE_LABELS } from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { activityApi, usersApi } from "../lib/api";

export default function AdminAgentActivity() {
  const { agentId } = useParams();
  const { user, profile, authMode } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const allowed = isAdmin(profile) || isAlpha(profile);

  useEffect(() => {
    if (!agentId || !allowed) return;
    if (authMode === "api") {
      usersApi.get(agentId).then(({ user: item }) => setAgent(item)).catch(() => setAgent(null));
      return;
    }
    return onSnapshot(doc(db, "users", agentId), (snap) => {
      setAgent(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [agentId, allowed, authMode]);

  useEffect(() => {
    if (!agentId || !allowed) return;
    if (authMode === "api") {
      activityApi
        .list(`agentId=${encodeURIComponent(agentId)}`)
        .then((response) => {
          setLogs(response.activities || response.activity || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }
    const q = query(
      collection(db, "activityLog"),
      where("actorUid", "==", agentId),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        // fallback without composite index
        const q2 = query(collection(db, "activityLog"), orderBy("createdAt", "desc"), limit(200));
        return onSnapshot(q2, (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((l) => l.actorUid === agentId);
          setLogs(list);
          setLoading(false);
        });
      }
    );
  }, [agentId, allowed, authMode]);

  if (!allowed) {
    return <p className="text-sm text-text-muted">Only Admin and Alpha can view agent activity.</p>;
  }

  async function toggleSuspend() {
    if (!agent || !isAdmin(profile)) return;
    const next = agent.status === "suspended" ? "active" : "suspended";
    if (authMode === "api") await usersApi.update(agent.id, { status: next });
    else await updateDoc(doc(db, "users", agent.id), { status: next });
    await logActivity({
      actorUid: user.uid,
      actorName: profile?.name || user.email,
      action: next === "suspended" ? "agent.suspend" : "agent.activate",
      targetUid: agent.id,
      targetName: agent.name || agent.email,
    });
  }

  async function requirePassword() {
    if (!agent || !isAdmin(profile)) return;
    if (authMode === "api") await usersApi.update(agent.id, { mustChangePassword: true });
    else await updateDoc(doc(db, "users", agent.id), { mustChangePassword: true });
    await logActivity({
      actorUid: user.uid,
      actorName: profile?.name || user.email,
      action: "agent.force_password",
      targetUid: agent.id,
      targetName: agent.name || agent.email,
    });
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/admin/agents")}
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft size={16} /> All agents
      </button>

      {agent && (
        <div className="rounded-2xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {agent.name || agent.email}
              </h1>
              <p className="text-sm text-text-muted">
                {ROLE_LABELS[agent.role] || agent.role} · {agent.email}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Status: {agent.status || "active"}
                {agent.mustChangePassword ? " · Must change password" : ""}
              </p>
            </div>
            {isAdmin(profile) && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={requirePassword}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs"
                >
                  <KeyRound size={14} /> Require password change
                </button>
                <button
                  type="button"
                  onClick={toggleSuspend}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs"
                >
                  {agent.status === "suspended" ? (
                    <>
                      <CheckCircle2 size={14} /> Activate
                    </>
                  ) : (
                    <>
                      <Ban size={14} /> Suspend
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border-subtle bg-bg-panel">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <ScrollText size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Activity (with ref numbers)</h2>
        </div>
        {loading && <p className="px-4 py-8 text-center text-sm text-text-muted">Loading…</p>}
        {!loading && logs.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">No activity recorded yet.</p>
        )}
        <ul className="divide-y divide-border-subtle">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <p className="text-sm font-medium text-text-primary">{l.action}</p>
              <p className="text-xs text-text-muted">
                {l.targetName ? `Target: ${l.targetName}` : null}
                {l.reference && (
                  <span className="ml-2 font-mono text-accent">Ref: {l.reference}</span>
                )}
              </p>
              <p className="text-[11px] text-text-muted">
                {l.createdAt?.toDate
                  ? l.createdAt.toDate().toLocaleString()
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
