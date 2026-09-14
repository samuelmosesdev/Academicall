import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { ScrollText, Search } from "lucide-react";
import Modal from "../components/Modal";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { isAdmin, isAlpha } from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { activityApi, usersApi } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AdminActivityLog() {
  const { profile, authMode } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("ref") || "");

  const allowed = isAdmin(profile) || isAlpha(profile);

  useEffect(() => {
    if (!allowed) return;
    if (authMode === "api") {
      let alive = true;
      activityApi.list().then((response) => {
        if (!alive) return;
        const activity = response.activities || response.activity || [];
        setLogs(activity.map((item) => ({
          ...item,
          actorName: item.meta?.actorName || item.userName || item.user?.name,
          targetUid: item.meta?.targetUid,
          targetName: item.meta?.targetName,
        })));
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }

    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [allowed, authMode]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter((l) =>
      [l.action, l.actorName, l.userName, l.targetName, l.reference]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s))
    );
  }, [logs, search]);

  const navigate = useNavigate();

  const [confirmAction, setConfirmAction] = useState(null);

  async function doToggleSuspend(uid) {
    try {
      if (authMode === "api") {
        const { user } = await usersApi.get(uid);
        const status = user.status === "suspended" ? "active" : "suspended";
        await usersApi.update(uid, { status });
        await logActivity({
          action: "user.suspend",
          targetUid: uid,
          meta: { status },
        });
        alert("Status updated");
        return;
      }
      const uref = doc(db, "users", uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) throw new Error("User not found");
      const status = snap.data().status === "suspended" ? "active" : "suspended";
      await updateDoc(uref, { status });
      await logActivity({
        actorUid: profile?.uid || null,
        actorName: profile?.name || "Admin",
        action: "user.suspend",
        targetUid: uid,
        meta: { status },
      });
      alert("Status updated");
    } catch (e) {
      alert(e.message || "Could not update status");
    }
  }

  async function doRevertRole(l) {
    if (!l.targetUid || !l.meta?.from) return alert("No previous role recorded");
    try {
      if (authMode === "api") {
        await usersApi.update(l.targetUid, { role: l.meta.from });
        await logActivity({
          action: "role.revert",
          targetUid: l.targetUid,
          targetName: l.targetName || null,
          meta: { from: l.meta.to, to: l.meta.from },
        });
        alert("Role reverted");
        return;
      }
      await updateDoc(doc(db, "users", l.targetUid), { role: l.meta.from });
      await logActivity({
        actorUid: profile?.uid || null,
        actorName: profile?.name || "Admin",
        action: "role.revert",
        targetUid: l.targetUid,
        targetName: l.targetName || null,
        meta: { from: l.meta.to, to: l.meta.from },
      });
      alert("Role reverted");
    } catch (e) {
      alert(e.message || "Could not revert role");
    }
  }

  async function doCancelClass(l) {
    if (!l.reference) return alert("No class reference recorded");
    if (authMode === "api") return alert("Class cancellation is not available in the API yet.");
    try {
      await deleteDoc(doc(db, "classEvents", l.reference));
      await logActivity({
        actorUid: profile?.uid || null,
        actorName: profile?.name || "Admin",
        action: "class.cancel",
        reference: l.reference,
        meta: { viaAdmin: true },
      });
      alert("Class cancelled");
    } catch (e) {
      alert(e.message || "Could not cancel class");
    }
  }

  if (!allowed) {
    return (
      <p className="text-sm text-text-muted">
        Only Admin and Alpha Agents can view the activity log.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Activity log</h1>
        <p className="text-sm text-text-secondary">
          Role changes, suspensions, approvals, deletes and PRO changes.
        </p>
      </div>
      {confirmAction && (
        <Modal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.type === 'suspend' ? 'Toggle user suspend' : confirmAction.type === 'revert-role' ? 'Revert role' : 'Cancel class'}
        >
          <p className="text-sm text-text-muted">
            {confirmAction.type === 'suspend' && 'Are you sure you want to toggle suspension for this user?'}
            {confirmAction.type === 'revert-role' && 'Revert the role change recorded in this log entry? This will set the user back to their previous role.'}
            {confirmAction.type === 'cancel-class' && 'Cancel the referenced class event and notify students? This action cannot be undone.'}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfirmAction(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
            <button
              onClick={async () => {
                const ca = confirmAction;
                setConfirmAction(null);
                if (!ca) return;
                if (ca.type === 'suspend') await doToggleSuspend(ca.payload);
                if (ca.type === 'revert-role') await doRevertRole(ca.entry);
                if (ca.type === 'cancel-class') await doCancelClass(ca.entry);
              }}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg-app"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:max-w-sm">
        <Search size={15} className="text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actions, names…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle p-10 text-center text-sm text-text-muted">
          <ScrollText size={28} className="mx-auto mb-2 opacity-50" />
          No activity yet.
        </div>
      )}

      <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">
        {filtered.map((l) => (
          <div key={l.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] font-mono text-text-secondary">
                {l.action}
              </span>
              <span className="text-xs text-text-muted">
                {l.createdAt?.toDate
                  ? l.createdAt.toDate().toLocaleString()
                  : l.createdAt
                    ? new Date(l.createdAt).toLocaleString()
                    : "—"}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-primary">
              <strong>{l.actorName || l.userName || "System"}</strong>
              {l.targetName ? <> → {l.targetName}</> : null}
            </p>
            {l.reference && (
              <p className="text-xs text-text-muted">Ref: {l.reference}</p>
            )}
            {/** Action buttons when applicable */}
            <div className="mt-2 flex items-center gap-2">
              {l.targetUid && (
                <button onClick={() => navigate(`/admin/users?uid=${l.targetUid}`)} className="rounded-lg border px-2 py-1 text-xs">View user</button>
              )}
              {l.action && l.action.toLowerCase().includes("suspend") && l.targetUid && (
                <button onClick={() => setConfirmAction({ type: 'suspend', payload: l.targetUid, entry: l })} className="rounded-lg border px-2 py-1 text-xs">Toggle suspend</button>
              )}
              {l.action === "role.change" && l.meta?.from && l.targetUid && (
                <button onClick={() => setConfirmAction({ type: 'revert-role', payload: null, entry: l })} className="rounded-lg border px-2 py-1 text-xs">Revert role</button>
              )}
              {l.action === "class.schedule" && l.reference && (
                <button onClick={() => setConfirmAction({ type: 'cancel-class', payload: null, entry: l })} className="rounded-lg border px-2 py-1 text-xs text-status-danger">Cancel class</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
