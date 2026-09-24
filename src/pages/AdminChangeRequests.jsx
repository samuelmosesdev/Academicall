import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Search,
  Check,
  X,
  Clock,
  FileEdit,
  User,
  Filter,
} from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { requestsApi, usersApi } from "../lib/api";

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export default function AdminChangeRequests() {
  const { user, authMode } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState({});

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      requestsApi.listProfileChanges().then(({ requests: list = [] }) => {
        if (alive) { setRequests(list); setLoading(false); }
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    const unsub = onSnapshot(
      collection(db, "profileChangeRequests"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setRequests(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  const filtered = useMemo(() => {
    let list = requests;
    if (tab !== "all") list = list.filter((r) => r.status === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.userName, r.userEmail, r.uniqueId, r.fieldLabel, r.requestedValue, r.reason]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }
    return list;
  }, [requests, tab, search]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  async function handleReview(req, decision) {
    if (!user) return;
    const ok = window.confirm(
      decision === "approved"
        ? `Approve change of ${req.fieldLabel} to "${req.requestedValue}" for ${req.userName || req.userEmail}?`
        : `Reject this change request from ${req.userName || req.userEmail}?`
    );
    if (!ok) return;

    setBusyId(req.id);
    try {
      if (decision === "approved") {
        if (authMode === "api") {
          await requestsApi.updateProfileChange(req.id, {
            status: decision,
            reviewedBy: user.uid,
            reviewedByName: profile?.name || user.email,
            adminNote: (note[req.id] || "").trim() || null,
          });
        } else {
          const patch = { [req.field]: req.requestedValue, updatedAt: serverTimestamp() };
          await updateDoc(doc(db, "users", req.userId), patch);
        }
      }

      if (!(authMode === "api" && decision === "approved")) {
        const review = {
          status: decision,
          reviewedAt: new Date().toISOString(),
          reviewedBy: user.uid,
          adminNote: (note[req.id] || "").trim() || null,
        };
        if (authMode === "api") await requestsApi.updateProfileChange(req.id, review);
        else await updateDoc(doc(db, "profileChangeRequests", req.id), { ...review, reviewedAt: serverTimestamp() });
      }
    } catch (err) {
      alert(err.message || "Could not process request.");
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleString();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Profile change requests
          </h1>
          <p className="text-sm text-text-secondary">
            Students can only change locked identity fields after you approve.
            {pendingCount > 0 && (
              <span className="ml-2 font-medium text-accent">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2">
          <Search size={15} className="text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, field…"
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-accent text-bg-app"
                : "border border-border-subtle bg-bg-panel text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {t.id === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="rounded-xl border border-border-subtle bg-bg-panel px-4 py-8 text-center text-sm text-text-muted">
            Loading requests…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-panel px-4 py-10 text-center">
            <FileEdit size={28} className="mx-auto mb-2 text-text-muted opacity-50" />
            <p className="text-sm text-text-muted">No requests in this view.</p>
          </div>
        )}

        {filtered.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border-subtle bg-bg-panel p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <User size={18} />
                </span>
                <div>
                  <p className="font-semibold text-text-primary">
                    {r.userName || "Student"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {r.userEmail}
                    {r.uniqueId ? ` · ${r.uniqueId}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock size={11} />
                    {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoCell label="Field" value={r.fieldLabel} />
              <InfoCell label="Current" value={r.currentValue} />
              <InfoCell label="Requested" value={r.requestedValue} accent />
            </div>

            <div className="mt-3 rounded-lg border border-border-subtle bg-bg-app px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Reason
              </p>
              <p className="mt-0.5 text-sm text-text-primary">{r.reason}</p>
            </div>

            {r.status === "pending" && (
              <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
                <input
                  value={note[r.id] || ""}
                  onChange={(e) =>
                    setNote((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  placeholder="Optional admin note…"
                  className="w-full rounded-lg border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleReview(r, "approved")}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
                  >
                    <Check size={15} />
                    Approve & apply
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleReview(r, "rejected")}
                    className="flex items-center gap-1.5 rounded-lg border border-status-danger/40 px-4 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60"
                  >
                    <X size={15} />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {r.status !== "pending" && r.adminNote && (
              <p className="mt-3 text-xs text-text-muted">
                Admin note: {r.adminNote}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCell({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-app px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-medium ${
          accent ? "text-accent" : "text-text-primary"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: "bg-status-warning/15 text-status-warning",
    approved: "bg-accent-soft text-accent",
    rejected: "bg-status-danger/15 text-status-danger",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        map[status] || map.pending
      }`}
    >
      {status}
    </span>
  );
}
