import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Search, Check, X, FileEdit, Loader2, GraduationCap, Users } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../lib/activityLog";
import { coursesApi, documentsApi, notificationsApi, requestsApi } from "../lib/api";

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export default function AdminRequests() {
  const { user, profile, authMode } = useAuth();
  const [profileReqs, setProfileReqs] = useState([]);
  const [genericReqs, setGenericReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState("student"); // student | courseRep
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState({});

  useEffect(() => {
    if (authMode === "api") {
      requestsApi.listProfileChanges().then(({ requests: list = [] }) => setProfileReqs(list.map((item) => ({ ...item, _source: "profile", _who: "student" })))).catch(() => setProfileReqs([]));
      return;
    }
    return onSnapshot(
      collection(db, "profileChangeRequests"),
      (snap) => {
        setProfileReqs(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            _source: "profile",
            _who: "student",
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [authMode]);

  useEffect(() => {
    if (authMode === "api") {
      requestsApi.list().then(({ requests: list = [] }) => setGenericReqs(list.map((item) => ({ ...item, _source: "generic", _who: item.requesterRole === "courseRep" ? "courseRep" : "student" })))).catch(() => setGenericReqs([]));
      return;
    }
    return onSnapshot(
      collection(db, "requests"),
      (snap) => {
        setGenericReqs(
          snap.docs.map((d) => {
            const data = d.data();
            const role = data.requesterRole || "user";
            return {
              id: d.id,
              ...data,
              _source: "generic",
              _who: role === "courseRep" ? "courseRep" : "student",
            };
          })
        );
      },
      () => {}
    );
  }, [authMode]);

  const all = useMemo(() => {
    const merged = [...profileReqs, ...genericReqs];
    merged.sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
    return merged;
  }, [profileReqs, genericReqs]);

  const filtered = useMemo(() => {
    let list = all.filter((r) => r._who === who);
    if (tab !== "all") {
      list = list.filter((r) => (r.status || "pending") === tab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [
          r.userName,
          r.userEmail,
          r.requesterName,
          r.requesterEmail,
          r.fieldLabel,
          r.title,
          r.type,
          r.requestedValue,
          r.reason,
          r.payload?.courseDraft?.code,
          r.payload?.courseDraft?.title,
        ]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }
    return list;
  }, [all, who, tab, search]);

  const studentPending = all.filter(
    (r) => r._who === "student" && (r.status || "pending") === "pending"
  ).length;
  const repPending = all.filter(
    (r) => r._who === "courseRep" && (r.status || "pending") === "pending"
  ).length;

  async function reviewProfile(req, decision) {
    setBusyId(req.id);
    try {
      if (authMode === "api") {
        await requestsApi.updateProfileChange(req.id, { status: decision, reviewedBy: user.uid, reviewedByName: profile?.name || user.email, adminNote: (note[req.id] || "").trim() || null });
      } else {
        if (decision === "approved") await updateDoc(doc(db, "users", req.userId), { [req.field]: req.requestedValue, updatedAt: serverTimestamp() });
        await updateDoc(doc(db, "profileChangeRequests", req.id), { status: decision, reviewedAt: serverTimestamp(), reviewedBy: user.uid, reviewedByName: profile?.name || user.email, adminNote: (note[req.id] || "").trim() || null });
      }
      await notificationsApi.create({
        userId: req.userId,
        type: "request_" + decision,
        title:
          decision === "approved"
            ? "Profile change approved"
            : "Profile change rejected",
        body: `${req.fieldLabel}: ${req.requestedValue}${
          note[req.id] ? ` — ${note[req.id]}` : ""
        }`,
        readByUser: false,
      }).catch(() => {});
      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "profile_request." + decision,
        targetUid: req.userId,
        targetName: req.userName,
        meta: { field: req.field },
      });
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewGeneric(req, decision) {
    setBusyId(req.id);
    try {
      if (decision === "approved" && req.type === "course_bulk" && req.payload?.courses) {
        for (const row of req.payload.courses) {
          await coursesApi.create({
            ...row,
            code: (row.code || "").toUpperCase(),
            source: "courseRep-ai",
          });
        }
      }
      if (decision === "approved" && req.type === "course" && req.payload?.courseDraft) {
        const draft = req.payload.courseDraft;
        await coursesApi.create({
          ...draft,
          code: (draft.code || "").toUpperCase(),
          department: draft.department || null,
          faculty: draft.faculty || null,
          source: "courseRep",
        });
      }
      if (decision === "approved" && req.type === "material" && req.payload?.documentDraft) {
        await documentsApi.create({
          ...req.payload.documentDraft,
          source: req.payload.documentDraft.source || "courseRep",
        });
      }

      if (authMode === "api") {
        await requestsApi.update(req.id, {
          status: decision,
          reviewedAt: new Date().toISOString(),
          reviewedBy: user.uid,
          reviewedByName: profile?.name || user.email,
          reviewNote: (note[req.id] || "").trim() || null,
        });
      } else {
        await updateDoc(doc(db, "requests", req.id), {
          status: decision,
          reviewedAt: serverTimestamp(),
          reviewedBy: user.uid,
          reviewedByName: profile?.name || user.email,
          reviewNote: (note[req.id] || "").trim() || null,
        });
      }

      if (req.requesterUid) {
        await notificationsApi.create({
          userId: req.requesterUid,
          type: "request_" + decision,
          title:
            decision === "approved" ? "Request approved" : "Request rejected",
          body:
            (req.title || req.type) +
            (note[req.id] ? ` — ${note[req.id]}` : ""),
            readByUser: false,
        }).catch(() => {});
      }

      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "request." + decision,
        targetUid: req.requesterUid,
        meta: { type: req.type },
      });
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleReview(req, decision) {
    if (!window.confirm(`${decision === "approved" ? "Approve" : "Reject"} this request?`)) {
      return;
    }
    if (req._source === "profile") return reviewProfile(req, decision);
    return reviewGeneric(req, decision);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Requests</h1>
        <p className="text-sm text-text-secondary">
          Students: profile changes. Course Reps: new courses (and materials) for their department.
        </p>
      </div>

      {/* Who: Student vs Course Rep */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setWho("student")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
            who === "student"
              ? "bg-accent text-bg-app"
              : "border border-border-subtle text-text-secondary"
          }`}
        >
          <Users size={16} /> Students
          {studentPending > 0 && (
            <span className="rounded-full bg-black/20 px-1.5 text-[11px]">
              {studentPending}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setWho("courseRep")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
            who === "courseRep"
              ? "bg-accent text-bg-app"
              : "border border-border-subtle text-text-secondary"
          }`}
        >
          <GraduationCap size={16} /> Course Reps
          {repPending > 0 && (
            <span className="rounded-full bg-black/20 px-1.5 text-[11px]">
              {repPending}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2">
          <Search size={14} className="text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle px-4 py-12 text-center text-sm text-text-muted">
          <FileEdit size={28} className="mx-auto mb-2 opacity-40" />
          No {who === "student" ? "student" : "course rep"} requests here.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const pending = (r.status || "pending") === "pending";
          const isProfile = r._source === "profile";
          const draft = r.payload?.courseDraft;
          return (
            <div
              key={`${r._source}-${r.id}`}
              className="rounded-xl border border-border-subtle bg-bg-panel p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent">
                  {isProfile ? "profile" : r.type || "request"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    r.status === "approved"
                      ? "bg-green-500/15 text-green-600"
                      : r.status === "rejected"
                        ? "bg-red-500/15 text-red-500"
                        : "bg-amber-500/15 text-amber-600"
                  }`}
                >
                  {r.status || "pending"}
                </span>
              </div>

              <p className="mt-2 text-sm font-medium text-text-primary">
                {isProfile
                  ? `${r.fieldLabel}: ${r.currentValue} → ${r.requestedValue}`
                  : r.title || "Request"}
              </p>

              {draft && (
                <p className="mt-1 text-xs text-text-secondary">
                  {draft.code} — {draft.title}
                  {draft.department ? ` · ${draft.department}` : ""}
                  {draft.level ? ` · ${draft.level}` : ""}
                </p>
              )}

              <p className="mt-1 text-xs text-text-muted">
                {r.userName || r.requesterName || "—"} ·{" "}
                {r.userEmail || r.requesterEmail || ""}
              </p>
              {(r.reason || r.details) && (
                <p className="mt-2 text-sm text-text-secondary">
                  {r.reason || r.details}
                </p>
              )}

              {pending && (
                <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
                  <textarea
                    value={note[r.id] || ""}
                    onChange={(e) =>
                      setNote((n) => ({ ...n, [r.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Optional comment"
                    className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => handleReview(r, "approved")}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg-app"
                    >
                      {busyId === r.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => handleReview(r, "rejected")}
                      className="flex items-center gap-1 rounded-lg border border-status-danger/40 px-3 py-1.5 text-xs font-semibold text-status-danger"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}