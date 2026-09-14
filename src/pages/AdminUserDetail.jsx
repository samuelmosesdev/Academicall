import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, GraduationCap, KeyRound } from "lucide-react";
import { usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../lib/activityLog";
import { ROLE_LABELS } from "../lib/roles";
import { FACULTIES, departmentsFor, LEVELS } from "../data/facultyData";

const fieldClass = "rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary";

export default function AdminUserDetail() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: adminUser, profile: adminProfile } = useAuth();
  const backPath = location.pathname.startsWith("/agent") ? "/agent/users" : "/admin/users";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [resetResult, setResetResult] = useState(null);
  const [repFaculty, setRepFaculty] = useState("");
  const [repDepartment, setRepDepartment] = useState("");
  const [repLevel, setRepLevel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await usersApi.get(userId);
      const nextUser = response.user || response;
      setUser(nextUser);
      setRepFaculty(nextUser.faculty || nextUser.courseRepMeta?.faculty || "");
      setRepDepartment(nextUser.department || nextUser.courseRepMeta?.department || "");
      setRepLevel(nextUser.level || nextUser.courseRepMeta?.level || "");
    } catch (err) {
      setError(err.message || "Failed to load user.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const repDepartments = useMemo(() => departmentsFor(repFaculty), [repFaculty]);
  const actorId = adminUser?.uid || adminUser?.id;

  async function makeCourseRep() {
    if (!repDepartment.trim() || !repLevel.trim()) {
      setActionError("Select department and level for Course Rep.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const department = repDepartment.trim();
      const level = repLevel.trim();
      const response = await usersApi.update(userId, {
        role: "courseRep",
        courseRepMeta: { faculty: repFaculty || null, department, level },
        faculty: repFaculty || user.faculty || null,
        department,
        level,
        assignedBy: actorId,
        assignedAt: new Date().toISOString(),
      });
      await logActivity({
        actorUid: actorId,
        actorName: adminProfile?.name || adminUser?.email,
        action: "role.change",
        targetUid: userId,
        targetName: user.name || user.email,
        meta: {
          from: user.role || "user",
          to: "courseRep",
          department,
          level,
        },
      });
      setUser((previous) => ({ ...previous, ...(response.user || response), role: "courseRep" }));
      await load();
    } catch (err) {
      setActionError(err.message || "Could not assign Course Rep.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCourseRep() {
    if (!window.confirm("Remove Course Rep role?")) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await usersApi.update(userId, {
        role: "user",
        courseRepMeta: null,
        assignedBy: actorId,
        assignedAt: new Date().toISOString(),
      });
      await logActivity({
        actorUid: actorId,
        actorName: adminProfile?.name || adminUser?.email,
        action: "role.change",
        targetUid: userId,
        targetName: user.name || user.email,
        meta: { from: user.role || "courseRep", to: "user" },
      });
      setUser((previous) => ({ ...previous, ...(response.user || response), role: "user" }));
      await load();
    } catch (err) {
      setActionError(err.message || "Failed to remove Course Rep.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    const next = user.status === "suspended" ? "active" : "suspended";
    setBusy(true);
    setActionError("");
    try {
      const response = await usersApi.update(userId, { status: next });
      await logActivity({
        actorUid: actorId,
        actorName: adminProfile?.name || adminUser?.email,
        action: next === "suspended" ? "user.suspend" : "user.reactivate",
        targetUid: userId,
        targetName: user.name || user.email,
      });
      setUser((previous) => ({ ...previous, ...(response.user || response) }));
    } catch (err) {
      setActionError(err.message || "Failed to update status.");
    } finally {
      setBusy(false);
    }
  }

  async function forcePasswordChange() {
    if (!window.confirm("Force password change on next login?")) return;
    setBusy(true);
    setActionError("");
    try {
      await usersApi.update(userId, { mustChangePassword: true });
      await load();
    } catch (err) {
      setActionError(err.message || "Failed to require password change.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!window.confirm(`Reset password for ${user.email}?`)) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await usersApi.resetPassword(userId);
      setResetResult(response);
      await load();
    } catch (err) {
      setActionError(err.message || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading user…</div>;
  if (error || !user) {
    return <div className="space-y-4 p-6"><Link to={backPath} className="text-sm text-accent"><ArrowLeft className="mr-1 inline" size={16} /> Back</Link><p className="text-sm text-status-danger">{error || "User not found."}</p></div>;
  }

  const meta = user.courseRepMeta || {};
  const profileRows = [
    ["Faculty", user.faculty], ["Department", user.department], ["Level", user.level],
    ["Matric", user.matricNumber], ["Phone", user.phone], ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Profile complete", user.profileComplete ? "Yes" : "No"], ["Must change password", user.mustChangePassword ? "Yes" : "No"],
    ["Questions practiced", user.questionsPracticedCount], ["Study streak", user.studyStreakDays],
    ["Joined", user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"],
  ];

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate(backPath)} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent"><ArrowLeft size={16} /> Back to users</button>
      <Link to={`/admin/users/${userId}/activity`} className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app">View activity timeline</Link>
      <div className="rounded-xl border border-border-subtle bg-bg-panel p-5">
        <div className="flex flex-wrap items-start gap-4">
          {user.photoUrl || user.photoURL || user.avatarUrl ? <img src={user.photoUrl || user.photoURL || user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent">{(user.name || user.email || "?").charAt(0).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold text-text-primary">{user.name || user.email}</h1><p className="text-sm text-text-muted">{user.email}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">{ROLE_LABELS[user.role] || user.role || "Student"}</span><span className="rounded-full border border-border-subtle px-2.5 py-0.5">{user.status || "active"}</span><span className="rounded-full border border-border-subtle px-2.5 py-0.5">{user.plan || "free"}</span>{user.uniqueId && <span className="font-mono text-text-muted">{user.uniqueId}</span>}</div></div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{profileRows.map(([label, value]) => <div key={label}><dt className="text-xs text-text-muted">{label}</dt><dd className="font-medium text-text-primary">{value ?? "—"}</dd></div>)}</dl>
        {user.role === "courseRep" && <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/30 p-3 text-sm"><div className="font-semibold text-accent">Course Rep assignment</div><p className="text-text-muted">{[meta.faculty || user.faculty, meta.department || user.department, meta.level || user.level].filter(Boolean).join(" · ") || "No scope saved"}</p></div>}
      </div>
      {actionError && <p className="text-sm text-status-danger">{actionError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={toggleSuspend} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">{user.status === "suspended" ? <><CheckCircle2 size={15} /> Reactivate</> : <><Ban size={15} /> Suspend</>}</button>
        <button type="button" disabled={busy} onClick={forcePasswordChange} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><KeyRound size={15} /> Force password change</button>
        <button type="button" disabled={busy} onClick={resetPassword} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><KeyRound size={15} /> Reset password</button>
      </div>
      {resetResult && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Temp password for <strong>{resetResult.email}</strong>: <code className="font-mono font-bold">{resetResult.tempPassword}</code><p className="mt-1 text-xs text-text-muted">Shown once. Share securely.</p></div>}
      <div className="rounded-xl border border-border-subtle bg-bg-panel p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><GraduationCap size={16} /> Course Rep</h2>{user.role === "courseRep" ? <button type="button" disabled={busy} onClick={removeCourseRep} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Remove Course Rep role</button> : <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><select value={repFaculty} onChange={(event) => { setRepFaculty(event.target.value); setRepDepartment(""); }} className={fieldClass}><option value="">Faculty</option>{FACULTIES.map((faculty) => <option key={faculty.name} value={faculty.name}>{faculty.name}</option>)}</select><select value={repDepartment} onChange={(event) => setRepDepartment(event.target.value)} className={fieldClass} disabled={!repFaculty}><option value="">Department</option>{repDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select><select value={repLevel} onChange={(event) => setRepLevel(event.target.value)} className={fieldClass}><option value="">Level</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></div><button type="button" disabled={busy} onClick={makeCourseRep} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60">Assign as Course Rep</button></div>}</div>
    </div>
  );
}
