import { useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import {
  isAdmin,
  isAlpha,
  ADMIN_ASSIGNABLE,
  ALPHA_ASSIGNABLE,
  ROLE_LABELS,
} from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { usersApi } from "../lib/api";
import { FACULTIES, departmentsFor, LEVELS } from "../data/facultyData";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";

/**
 * Course Rep is scoped to ONE department + ONE level (not whole department).
 */
export default function AssignRoleControl({ targetUser }) {
  const { user, profile } = useAuth();
  const { programsFor } = useAcademicCatalog();
  const [role, setRole] = useState(targetUser.role || "user");
  const [codes, setCodes] = useState(
    (targetUser.courseRepMeta?.courseCodes || []).join(", ")
  );
  const [repFaculty, setRepFaculty] = useState(
    targetUser.courseRepMeta?.faculty || targetUser.faculty || ""
  );
  const [repDepartment, setRepDepartment] = useState(
    targetUser.courseRepMeta?.department || targetUser.department || ""
  );
  const [repProgram, setRepProgram] = useState(
    targetUser.courseRepMeta?.program || targetUser.program || ""
  );
  const [repLevel, setRepLevel] = useState(
    targetUser.courseRepMeta?.level || targetUser.level || ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!isAdmin(profile) && !isAlpha(profile)) return null;
  if (isAlpha(profile) && targetUser.role === "admin") return null;

  const options = isAdmin(profile) ? ADMIN_ASSIGNABLE : ALPHA_ASSIGNABLE;
  const depts = departmentsFor(repFaculty);
  const programs = programsFor(repDepartment);

  async function save() {
    if (!options.includes(role)) return;
    setErr("");
    if (role === "courseRep") {
      if (!repDepartment.trim() || !repProgram.trim() || !programs.includes(repProgram.trim())) {
        setErr("Choose a program listed under the required parent department.");
        return;
      }
      if (!repLevel.trim() || !LEVELS.includes(repLevel)) {
        setErr("Level is required. Course Rep is one level per program.");
        return;
      }
    }
    setBusy(true);
    try {
      const patch = {
        role,
        assignedBy: user.uid,
        assignedAt: serverTimestamp(),
      };
      if (role === "courseRep") {
        const department = repDepartment.trim();
        const level = repLevel.trim();
        const faculty = repFaculty || null;
        patch.courseRepMeta = {
          courseCodes: codes
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          faculty,
          department,
          program: repProgram.trim(),
          level,
        };
        patch.faculty = faculty || targetUser.faculty || null;
        patch.department = department;
        patch.program = repProgram.trim();
        patch.level = level;
      } else {
        patch.courseRepMeta = null;
      }

      await usersApi.update(targetUser.id, {
        ...patch,
        assignedAt: new Date().toISOString(),
      });
      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "role.change",
        targetUid: targetUser.id,
        targetName: targetUser.name || targetUser.email,
        meta: {
          from: targetUser.role,
          to: role,
          department: role === "courseRep" ? repDepartment : null,
          level: role === "courseRep" ? repLevel : null,
        },
      });
      alert(
        role === "courseRep"
          ? `Course Rep for ${repDepartment} · ${repLevel}`
          : `Role updated to ${ROLE_LABELS[role] || role}`
      );
    } catch (e) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-panel-alt p-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r] || r}
          </option>
        ))}
      </select>

      {role === "courseRep" && (
        <>
          <select
            value={repFaculty}
            onChange={(e) => {
              setRepFaculty(e.target.value);
              setRepDepartment("");
              setRepProgram("");
            }}
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
          >
            <option value="">Faculty</option>
            {FACULTIES.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            value={repDepartment}
            onChange={(e) => {
              setRepDepartment(e.target.value);
              setRepProgram("");
            }}
            disabled={!repFaculty}
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
          >
            <option value="">Department *</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={repProgram}
            onChange={(e) => setRepProgram(e.target.value)}
            disabled={!repDepartment || programs.length === 0}
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
          >
            <option value="">{programs.length ? "Program *" : "No programs configured"}</option>
            {programs.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
          <select
            value={repLevel}
            onChange={(e) => setRepLevel(e.target.value)}
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
          >
            <option value="">Level * (one level only)</option>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
          <input
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder="Course codes (optional): CSC101, CSC102"
            className="rounded border border-border-subtle bg-bg-panel px-2 py-1 text-xs"
          />
          <p className="text-[0.7rem] text-text-muted">
            Course Rep covers <strong>one program + one level</strong> within its parent department.
          </p>
        </>
      )}

      {err && <p className="text-[0.7rem] text-status-danger">{err}</p>}

      <button
        type="button"
        disabled={busy || (role === "courseRep" && (!repDepartment || !repProgram || !repLevel))}
        onClick={save}
        className="rounded bg-accent px-2 py-1 text-xs font-semibold text-bg-app disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save role"}
      </button>
    </div>
  );
}
