import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  Users,
  GraduationCap,
  BadgeCheck,
} from "lucide-react";
import { useAdminUsers } from "../hooks/useAdminUsers";
import EditUserModal from "../components/EditUserModal";
import ViewProfileModal from "../components/ViewProfileModal";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../components/ui";
import { FACULTIES, departmentsFor, LEVELS } from "../data/facultyData";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../lib/activityLog";
import { ROLE_LABELS } from "../lib/roles";
import { usersApi } from "../lib/api";

const CATEGORIES = [
  {
    id: "students",
    label: "Students",
    match: (u) => !u.role || u.role === "user",
  },
  {
    id: "courseReps",
    label: "Course Reps",
    match: (u) => u.role === "courseRep",
  },
  {
    id: "agents",
    label: "Agents",
    match: (u) => u.role === "agent" || u.role === "alphaAgent",
  },
  { id: "all", label: "All", match: () => true },
];

const fieldClass =
  "rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

export default function AdminUsers() {
  const { user: adminUser, profile: adminProfile } = useAuth();
  const { users, loading, error, retry } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("students");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [repTarget, setRepTarget] = useState(null);
  const [repFaculty, setRepFaculty] = useState("");
  const [repDepartment, setRepDepartment] = useState("");
  const [repLevel, setRepLevel] = useState("");
  const [highlightedUserId, setHighlightedUserId] = useState(null);
  const rowRefs = useRef({});

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const uid = params.get("uid");
    if (uid) setHighlightedUserId(uid);
  }, [location.search]);

  useEffect(() => {
    if (!highlightedUserId) return;
    try {
      const el = rowRefs.current[highlightedUserId];
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // Add a temporary highlight class then remove it
        el.classList.add("highlight-row");
        setTimeout(() => {
          try { el.classList.remove("highlight-row"); } catch { /* ignore */ }
        }, 2000);
      }
    } catch (err) {
      // swallow DOM errors to avoid crashing the admin UI
      console.warn("Auto-focus failed:", err?.message || err);
    }
  }, [highlightedUserId]);

  const departments = useMemo(() => departmentsFor(faculty), [faculty]);
  const repDepartments = useMemo(
    () => departmentsFor(repFaculty),
    [repFaculty]
  );

  const filtered = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
    const q = search.trim().toLowerCase();

    return users.filter((u) => {
      if (!cat.match(u)) return false;
      if (category !== "agents") {
        if (faculty && u.faculty !== faculty) return false;
        if (department && u.department !== department) return false;
        if (level && u.level !== level) return false;
      }
      if (!q) return true;
      return [u.name, u.email, u.uniqueId, u.faculty, u.department, u.role]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [users, category, faculty, department, level, search]);

  const counts = useMemo(() => {
    const c = { students: 0, courseReps: 0, agents: 0, all: users.length };
    users.forEach((u) => {
      if (!u.role || u.role === "user") c.students += 1;
      if (u.role === "courseRep") c.courseReps += 1;
      if (u.role === "agent" || u.role === "alphaAgent") c.agents += 1;
    });
    return c;
  }, [users]);

  async function handleSaveEdit(updates) {
    setBusyId(editing.id);
    setActionError("");
    try {
      await usersApi.update(editing.id, updates);
      setEditing(null);
    } catch (err) {
      setActionError(err.message || "Couldn't save changes.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSuspend(u) {
    setBusyId(u.id);
    setActionError("");
    try {
      const next = u.status === "suspended" ? "active" : "suspended";
      await usersApi.update(u.id, { status: next });
      await logActivity({
        actorUid: adminUser.uid,
        actorName: adminProfile?.name || adminUser.email,
        action: next === "suspended" ? "user.suspend" : "user.reactivate",
        targetUid: u.id,
        targetName: u.name || u.email,
      });
    } catch (err) {
      setActionError(err.message || "Couldn't update status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(u) {
    const ok = window.confirm(
      `Delete ${u.name || u.email}? Prefer Suspend if you only want to block access.`
    );
    if (!ok) return;
    setBusyId(u.id);
    setActionError("");
    try {
      await usersApi.remove(u.id);
      await logActivity({
        actorUid: adminUser.uid,
        actorName: adminProfile?.name || adminUser.email,
        action: "user.delete",
        targetUid: u.id,
        targetName: u.name || u.email,
      });
    } catch (err) {
      setActionError(err.message || "Couldn't delete user.");
    } finally {
      setBusyId(null);
    }
  }

  function openMakeRep(u) {
    setRepTarget(u);
    setRepFaculty(u.faculty || "");
    setRepDepartment(u.department || "");
    setActionError("");
  }

  async function confirmMakeRep() {
    if (!repTarget) return;
    if (!repDepartment.trim()) {
      setActionError("Select the department this Course Rep represents.");
      return;
    }
    if (!repLevel.trim()) {
      setActionError(
        "Select the level. Each Course Rep covers one department + one level only."
      );
      return;
    }

    setBusyId(repTarget.id);
    setActionError("");
    try {
      const department = repDepartment.trim();
      const level = repLevel.trim();
      await usersApi.update(repTarget.id, {
        role: "courseRep",
        courseRepMeta: {
          faculty: repFaculty || null,
          department,
          level,
        },
        courseRepDepartment: department,
        courseRepLevel: level,
        faculty: repFaculty || repTarget.faculty || null,
        department,
        level,
        assignedBy: adminUser.uid,
        assignedAt: new Date().toISOString(),
      });
      await logActivity({
        actorUid: adminUser.uid,
        actorName: adminProfile?.name || adminUser.email,
        action: "role.change",
        targetUid: repTarget.id,
        targetName: repTarget.name || repTarget.email,
        meta: {
          to: "courseRep",
          faculty: repFaculty,
          department,
          level,
        },
      });
      setRepTarget(null);
      setRepFaculty("");
      setRepDepartment("");
      setRepLevel("");
    } catch (err) {
      setActionError(err.message || "Could not assign Course Rep.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCourseRep(u) {
    if (!window.confirm(`Remove Course Rep role from ${u.name || u.email}?`)) {
      return;
    }
    setBusyId(u.id);
    setActionError("");
    try {
      await usersApi.update(u.id, {
        role: "user",
        courseRepMeta: null,
        courseRepDepartment: null,
        courseRepLevel: null,
        assignedBy: adminUser.uid,
        assignedAt: new Date().toISOString(),
      });
      await logActivity({
        actorUid: adminUser.uid,
        actorName: adminProfile?.name || adminUser.email,
        action: "role.change",
        targetUid: u.id,
        targetName: u.name || u.email,
        meta: { to: "user" },
      });
    } catch (err) {
      setActionError(err.message || "Failed to remove Course Rep.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState message="Loading users…" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Browse by Students, Course Reps, or Agents. Assign Course Rep by department so they can schedule classes for course mates."
        actions={
          <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:w-64">
            <Search size={15} className="shrink-0 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, ID…"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        }
      />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              category === c.id
                ? "bg-accent text-bg-app"
                : "border border-border-subtle bg-bg-panel text-text-secondary hover:text-text-primary"
            }`}
          >
            {c.label}
            <span className="ml-2 text-xs opacity-80">
              ({counts[c.id] ?? 0})
            </span>
          </button>
        ))}
      </div>

      {/* Faculty / Dept / Level filters */}
      {category !== "agents" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-bg-panel p-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Faculty</label>
            <select
              value={faculty}
              onChange={(e) => {
                setFaculty(e.target.value);
                setDepartment("");
              }}
              className={`w-full ${fieldClass}`}
            >
              <option value="">All faculties</option>
              {FACULTIES.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`w-full ${fieldClass}`}
              disabled={!faculty}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={`w-full ${fieldClass}`}
            >
              <option value="">All levels</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users in this view"
          description="Try another category or clear faculty/department filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-panel">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Faculty / Dept</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const busy = busyId === u.id;
                const suspended = u.status === "suspended";
                const isRep = u.role === "courseRep";
                return (
                  <tr
                    key={u.id}
                    ref={(el) => (rowRefs.current[u.id] = el)}
                    className={`border-b border-border-subtle last:border-0 ${highlightedUserId === u.id ? 'bg-accent-soft' : ''}`}
                    id={`user-${u.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">
                        {u.name || "—"}
                      </div>
                      <div className="text-xs text-text-muted">
                        {u.email}
                        {u.uniqueId ? ` · ${u.uniqueId}` : ""}
                      </div>
                      {isRep && u.courseRepMeta?.department && (
                        <div className="mt-1 text-[11px] text-accent">
                          Represents: {u.courseRepMeta.department}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {ROLE_LABELS[u.role] || u.role || "Student"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {[u.faculty, u.department].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {u.level || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          suspended
                            ? "bg-status-danger/15 text-status-danger"
                            : "bg-accent-soft text-accent"
                        }`}
                      >
                        {suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(u)}
                          className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(u)}
                          className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>

                        {(!u.role || u.role === "user") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openMakeRep(u)}
                            className="rounded-lg p-2 text-accent hover:bg-accent-soft"
                            title="Make Course Rep"
                          >
                            <GraduationCap size={15} />
                          </button>
                        )}
                        {isRep && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeCourseRep(u)}
                            className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"
                            title="Remove Course Rep"
                          >
                            <BadgeCheck size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => toggleSuspend(u)}
                          className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"
                          title={suspended ? "Reactivate" : "Suspend"}
                        >
                          {suspended ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <Ban size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(u)}
                          className="rounded-lg p-2 text-text-muted hover:bg-status-danger/10 hover:text-status-danger"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Make Course Rep — by department */}
      {repTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-panel p-5 shadow-xl">
            <h3 className="text-base font-semibold text-text-primary">
              Make Course Rep
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {repTarget.name || repTarget.email} will represent one department + one level and
              can schedule classes for course mates in that department
              (notifications + timetable).
            </p>

            <label className="mt-4 block text-xs font-medium text-text-muted">
              Faculty
            </label>
            <select
              value={repFaculty}
              onChange={(e) => {
                setRepFaculty(e.target.value);
                setRepDepartment("");
              }}
              className={`mt-1 w-full ${fieldClass}`}
            >
              <option value="">Select faculty</option>
              {FACULTIES.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-medium text-text-muted">
              Department they represent *
            </label>
            <select
              value={repDepartment}
              onChange={(e) => setRepDepartment(e.target.value)}
              className={`mt-1 w-full ${fieldClass}`}
              disabled={!repFaculty}
            >
              <option value="">Select department</option>
              {repDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-medium text-text-muted">
              Level they represent * (one level only)
            </label>
            <select
              value={repLevel}
              onChange={(e) => setRepLevel(e.target.value)}
              className={`mt-1 w-full ${fieldClass}`}
            >
              <option value="">Select level</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-muted">
              A Course Rep is assigned to <strong>one department + one level</strong>.
              100 Level and 200 Level need different Course Reps.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRepTarget(null);
                  setRepFaculty("");
                  setRepDepartment("");
                  setRepLevel("");
                }}
                className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === repTarget.id || !repDepartment || !repLevel}
                onClick={confirmMakeRep}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"
              >
                {busyId === repTarget.id ? "Saving…" : "Confirm Course Rep"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          open={!!editing}
          busy={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
      {viewing && (
        <ViewProfileModal
          user={viewing}
          open={!!viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
