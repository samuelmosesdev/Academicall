/** Small shared pieces for the organisation screens. */

import { PRIORITY_LABEL, ORG_ROLE_LABEL, initialsOf } from "./orgHelpers";

const PRIORITY_TONE = { low: "", normal: "", high: "is-lemon", urgent: "is-danger" };

export function StaffAvatar({ person, size = 32 }) {
  const photo = person?.photoUrl || person?.avatarUrl;
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  return photo ? (
    <img src={photo} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-midnight font-semibold text-lemon dark:bg-lemon dark:text-midnight">
      {initialsOf(person?.name || person?.nickname)}
    </span>
  );
}

export function PriorityChip({ priority }) {
  if (!priority || priority === "normal") return null;
  return <span className={`acx-chip-sm ${PRIORITY_TONE[priority] || ""}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function RoleChip({ orgRole }) {
  if (!orgRole) return null;
  const tone = orgRole === "director" || orgRole === "hod" ? "is-lemon" : orgRole === "supervisor" ? "is-aqua" : "";
  return <span className={`acx-chip-sm ${tone}`}>{ORG_ROLE_LABEL[orgRole] || orgRole}</span>;
}

export function StatTile({ label, value, tone = "", hint }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "warn" ? "border-amber-400/50 bg-amber-400/10" : tone === "bad" ? "border-red-400/40 bg-red-400/10" : "border-border-subtle bg-bg-panel"}`}>
      <p className="num text-2xl font-light leading-none text-text-primary">{value}</p>
      <p className="mt-1.5 text-xs text-text-secondary">{label}</p>
      {hint && <p className="text-[0.7rem] text-text-muted">{hint}</p>}
    </div>
  );
}
