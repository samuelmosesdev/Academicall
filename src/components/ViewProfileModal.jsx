import { useAuth } from "../context/AuthContext";

const STAFF_ROLES = ["admin", "alphaAgent", "agent"];

/**
 * Profile details for a person. Contact details that are private between peers
 * (e-mail, phone, date of birth, matric number) only show when you are looking
 * at your own profile or you are staff. The body scrolls inside whatever modal
 * hosts it and never grows wider than the screen.
 */
export default function ViewProfileModal({ user }) {
  const { user: viewer, profile: viewerProfile } = useAuth() || {};
  if (!user) return null;

  const viewerId = viewer?.uid || viewer?.id || viewerProfile?.id;
  const subjectId = user.uid || user.id;
  const isSelf = Boolean(viewerId && subjectId && viewerId === subjectId);
  const isStaff = STAFF_ROLES.includes(viewerProfile?.role || viewer?.role);
  const privateOk = isSelf || isStaff;

  const fields = [
    privateOk && { label: "Email", value: user.email },
    { label: "Unique ID", value: user.uniqueId },
    { label: "Faculty", value: user.faculty },
    { label: "Department", value: user.department },
    { label: "Level", value: user.level },
    privateOk && { label: "Matric number", value: user.matricNumber },
    (privateOk || user.showPhone === true) && { label: "Phone", value: user.phone },
    privateOk && { label: "Date of birth", value: user.dob },
    privateOk && { label: "Gender", value: user.gender },
    { label: "Interests", value: Array.isArray(user.interests) ? user.interests.join(", ") : user.interests },
    isStaff && { label: "Status", value: user.status === "suspended" ? "Suspended" : "Active" },
  ].filter(Boolean);

  const name = user.nickname || user.name || (privateOk ? user.email : "") || "Student";
  const photo = user.photoUrl || user.avatarUrl || user.photoURL;

  return (
    <div
      className="max-h-[min(80dvh,40rem)] w-full max-w-[calc(100vw-2rem)] space-y-5 overflow-y-auto overscroll-contain"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {photo ? (
          <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {String(name)[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="break-words text-base font-semibold text-text-primary">{name}</div>
          {user.nickname && user.name && user.nickname !== user.name && (
            <div className="break-words text-xs text-text-muted">{user.name}</div>
          )}
          {privateOk && user.email && (
            <div className="break-all text-xs text-text-muted">{user.email}</div>
          )}
        </div>
      </div>

      {user.bio && (
        <p className="break-words rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-secondary">
          {user.bio}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm min-[420px]:grid-cols-2">
        {fields.map(
          ({ label, value }) =>
            value && (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className="break-words text-text-primary">{value}</dd>
              </div>
            )
        )}
      </dl>
    </div>
  );
}
