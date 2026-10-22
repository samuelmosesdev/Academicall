import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Activity, Ban, CheckCircle2, Copy, GraduationCap, KeyRound, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../lib/activityLog";
import { can, DUTY_LABELS, ROLE_LABELS } from "../lib/roles";
import AccessEditor from "../components/access/AccessEditor";
import { timeAgo } from "../lib/staffApi";
import { LEVELS } from "../data/facultyData";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";
import { appConfirm, notify } from "../lib/dialogs";

const fieldClass = "rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary";

export default function AdminUserDetail() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: adminUser, profile: adminProfile } = useAuth();
  const [catalogInstitution, setCatalogInstitution] = useState("uofa");
  const { faculties, departmentsFor, programsFor, loading: catalogLoading, error: catalogError } =
    useAcademicCatalog(catalogInstitution);
  const backPath = location.pathname.startsWith("/agent") ? "/agent/users" : "/admin/users";
  const [user, setUser] = useState(null);
  const [viewerInfo, setViewerInfo] = useState({ canManage: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [resetResult, setResetResult] = useState(null);
  const [repFaculty, setRepFaculty] = useState("");
  const [repDepartment, setRepDepartment] = useState("");
  const [repProgram, setRepProgram] = useState("");
  const [repLevel, setRepLevel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await usersApi.get(userId);
      const nextUser = response.user || response;
      setUser(nextUser);
      setViewerInfo(response.viewer || { canManage: false });
      setCatalogInstitution(nextUser.institutionId || "uofa");
      setRepFaculty(nextUser.courseRepMeta?.faculty || nextUser.faculty || "");
      setRepDepartment(nextUser.courseRepMeta?.department || nextUser.department || "");
      setRepProgram(nextUser.courseRepMeta?.program || nextUser.program || "");
      setRepLevel(nextUser.courseRepMeta?.level || nextUser.level || "");
    } catch (err) {
      setError(err.message || "Failed to load user.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const repDepartments = useMemo(() => departmentsFor(repFaculty), [departmentsFor, repFaculty]);
  const repPrograms = useMemo(() => programsFor(repDepartment, repFaculty), [programsFor, repDepartment, repFaculty]);
  const repLevels = repLevel && !LEVELS.includes(repLevel) ? [...LEVELS, repLevel] : LEVELS;
  const actorId = adminUser?.uid || adminUser?.id;

  async function makeCourseRep() {
    if (!repFaculty.trim() || !repDepartment.trim() || !repProgram.trim() || !repLevel.trim()) {
      setActionError("Select faculty, department, program, and level for Course Rep.");
      return;
    }
    if (!repPrograms.includes(repProgram.trim())) {
      setActionError("Select a program listed under the chosen department.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const faculty = repFaculty.trim();
      const department = repDepartment.trim();
      const program = repProgram.trim();
      const level = repLevel.trim();
      const response = await usersApi.update(userId, {
        role: "courseRep",
        courseRepMeta: { ...(user.courseRepMeta || {}), faculty, department, program, level },
        faculty,
        department,
        program,
        level,
        assignedBy: actorId,
        assignedAt: new Date().toISOString(),
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
    if (!await appConfirm(`${user.name || user.email} will be signed out on every device and must choose a new password the next time they sign in.`, { title: "Force a password change?", confirmLabel: "Force change", tone: "danger" })) return;
    setBusy(true);
    setActionError("");
    try {
      await usersApi.forcePasswordChange(userId, true);
      notify.success("Password change forced. They've been signed out.");
      await load();
    } catch (err) {
      setActionError(err.message || "Failed to require password change.");
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    if (!await appConfirm(`Sign ${user.name || user.email} out of every device?`, { confirmLabel: "Sign out" })) return;
    setBusy(true);
    setActionError("");
    try {
      await usersApi.signOutEverywhere(userId);
      notify.success("Signed out everywhere.");
      await load();
    } catch (err) {
      setActionError(err.message || "Couldn't sign them out.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!await appConfirm(`Close ${user.email}'s account? They won't be able to sign in. Their uploads stay in the Document Center.`, { title: "Delete account?", confirmLabel: "Delete account", tone: "danger" })) return;
    setBusy(true);
    setActionError("");
    try {
      await usersApi.remove(userId);
      notify.success("Account closed.");
      navigate(backPath);
    } catch (err) {
      setActionError(err.message || "Couldn't delete the account.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!await appConfirm(`Issue a temporary password for ${user.email}?`, { title: "Reset password?", confirmLabel: "Issue temporary password", tone: "danger" })) return;
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
  const viewer = { ...(adminProfile || {}), id: adminProfile?.id || actorId };
  const manage = viewerInfo.canManage;
  const canPassword = manage && can(adminProfile, "users.password");
  const canSuspend = manage && can(adminProfile, "users.suspend");
  const canDelete = manage && can(adminProfile, "users.delete");
  const canRep = manage && can(adminProfile, "users.courseRep") && !["admin", "alphaAgent", "agent"].includes(user.role);
  const activityPath = location.pathname.startsWith("/agent") ? null : `/admin/users/${userId}/activity`;
  const profileRows = [
    ["Institution", user.institution?.displayName || user.institution?.name],
    ["Faculty", user.faculty], ["Department", user.department], ["Level", user.level],
    ["Matric", user.matricNumber], ["Phone", user.phone], ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Profile complete", user.profileComplete ? "Yes" : "No"], ["Questions practiced", user.questionsPracticedCount],
    ["Study streak", user.studyStreakDays], ["Last active", user.lastActiveAt ? timeAgo(user.lastActiveAt) : "—"],
    ["Joined", user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate(backPath)} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent"><ArrowLeft size={16} /> Back to users</button>
        {activityPath && <Link to={activityPath} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-app"><Activity size={15} /> Activity timeline</Link>}
      </div>
      <div className="rounded-xl border border-border-subtle bg-bg-panel p-5">
        <div className="flex flex-wrap items-start gap-4">
          {user.photoUrl || user.photoURL || user.avatarUrl ? <img src={user.photoUrl || user.photoURL || user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent">{(user.name || user.email || "?").charAt(0).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold text-text-primary">{user.name || user.email}</h1><p className="text-sm text-text-muted">{user.email}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">{ROLE_LABELS[user.role] || user.role || "Student"}</span>{(user.staffTags || []).map((tag) => <span key={tag} className="rounded-full bg-bg-elevated px-2.5 py-0.5">{DUTY_LABELS[tag] || tag}</span>)}<span className="rounded-full border border-border-subtle px-2.5 py-0.5">{user.status || "active"}</span><span className="rounded-full border border-border-subtle px-2.5 py-0.5">{user.plan || "free"}</span>{user.uniqueId && <span className="font-mono text-text-muted">{user.uniqueId}</span>}</div></div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{profileRows.map(([label, value]) => <div key={label}><dt className="text-xs text-text-muted">{label}</dt><dd className="font-medium text-text-primary">{value ?? "—"}</dd></div>)}</dl>
        {user.role === "courseRep" && <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/30 p-3 text-sm"><div className="font-semibold text-accent">Course Rep assignment</div><p className="text-text-muted">{[user.institution?.displayName || user.institution?.name, meta.faculty || user.faculty, meta.program || user.program, meta.department || user.department, meta.level || user.level].filter(Boolean).join(" · ") || "No program assignment saved"}</p></div>}
      </div>
      {actionError && <p className="text-sm text-status-danger">{actionError}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {canPassword && <section className="rounded-xl border border-border-subtle bg-bg-panel p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} /> Sign-in & password</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={forcePasswordChange} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><KeyRound size={15} /> Force password change</button>
            <button type="button" disabled={busy} onClick={resetPassword} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><ShieldAlert size={15} /> Temporary password</button>
            <button type="button" disabled={busy} onClick={signOutEverywhere} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><LogOut size={15} /> Sign out everywhere</button>
          </div>
          {resetResult && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">Temporary password for <strong>{resetResult.email}</strong><div className="mt-1 flex items-center gap-2"><code className="font-mono font-bold">{resetResult.tempPassword}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); notify.success("Copied"); }}><Copy size={14} /></button></div><p className="mt-1 text-xs text-text-muted">Shown once. Share securely after verifying their identity.</p></div>}
        </section>}
        {canRep && <section className="rounded-xl border border-border-subtle bg-bg-panel p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><GraduationCap size={16} /> Course Rep</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-border-subtle bg-bg-panel-alt p-3 text-sm">
              <p className="font-semibold text-text-primary">Select an assignment within this student's institution</p>
              <p className="mt-1 text-text-muted">{user.institution?.displayName || user.institution?.name || "University of Abuja"}</p>
              {catalogLoading && <p className="mt-1 text-text-muted">Loading institution choices…</p>}
              {catalogError && <p className="mt-1 text-status-danger">{catalogError}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={repFaculty} onChange={(event) => { setRepFaculty(event.target.value); setRepDepartment(""); setRepProgram(""); }} className={fieldClass} disabled={catalogLoading || Boolean(catalogError)}>
                <option value="">Faculty</option>{faculties.map((faculty) => <option key={faculty.name} value={faculty.name}>{faculty.name}</option>)}
              </select>
              <select value={repDepartment} onChange={(event) => { setRepDepartment(event.target.value); setRepProgram(""); }} className={fieldClass} disabled={!repFaculty || catalogLoading || Boolean(catalogError)}>
                <option value="">Department</option>{repDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <select value={repProgram} onChange={(event) => setRepProgram(event.target.value)} className={fieldClass} disabled={!repDepartment || repPrograms.length === 0 || catalogLoading || Boolean(catalogError)}>
                <option value="">{repPrograms.length ? "Program *" : "No programs configured"}</option>{repPrograms.map((program) => <option key={program} value={program}>{program}</option>)}
              </select>
              <select value={repLevel} onChange={(event) => setRepLevel(event.target.value)} className={fieldClass}>
                <option value="">Level *</option>{repLevels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || catalogLoading || Boolean(catalogError) || !repFaculty || !repDepartment || !repProgram || !repLevel} onClick={makeCourseRep} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60">
                {user.role === "courseRep" ? "Save Course Rep assignment" : "Assign as Course Rep"}
              </button>
              {user.role === "courseRep" && <button type="button" disabled={busy} onClick={removeCourseRep} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Remove Course Rep role</button>}
            </div>
          </div>
        </section>}
        {(canSuspend || canDelete) && <section className="rounded-xl border border-border-subtle bg-bg-panel p-5"><h2 className="mb-3 text-sm font-semibold">Account status</h2><div className="flex flex-wrap gap-2">{canSuspend && <button type="button" disabled={busy} onClick={toggleSuspend} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">{user.status === "suspended" ? <><CheckCircle2 size={15} /> Reactivate</> : <><Ban size={15} /> Suspend</>}</button>}{canDelete && <button type="button" disabled={busy} onClick={deleteAccount} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600"><Trash2 size={15} /> Delete account</button>}</div></section>}
        <AccessEditor person={user} viewer={viewer} onSaved={(next) => setUser((previous) => ({ ...previous, ...next }))} />
      </div>
    </div>
  );
}
