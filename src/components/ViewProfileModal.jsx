export default function ViewProfileModal({ user }) {
  const fields = [
    { label: "Email", value: user.email },
    { label: "Unique ID", value: user.uniqueId },
    { label: "Faculty", value: user.faculty },
    { label: "Department", value: user.department },
    { label: "Level", value: user.level },
    { label: "Matric number", value: user.matricNumber },
    { label: "Phone", value: user.phone },
    { label: "Date of birth", value: user.dob },
    { label: "Gender", value: user.gender },
    { label: "Interests", value: user.interests },
    { label: "Status", value: user.status === "suspended" ? "Suspended" : "Active" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {(user.photoUrl || user.avatarUrl || user.photoURL) ? (
          <img src={user.photoUrl || user.avatarUrl || user.photoURL} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {(user.name || user.email || "?")[0].toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-base font-semibold text-text-primary">{user.name || "—"}</div>
          <div className="text-xs text-text-muted">{user.email}</div>
        </div>
      </div>

      {user.bio && (
        <p className="rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-secondary">
          {user.bio}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {fields.map(
          ({ label, value }) =>
            value && (
              <div key={label}>
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className="text-text-primary">{value}</dd>
              </div>
            )
        )}
      </dl>
    </div>
  );
}